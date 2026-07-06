// Supabase Edge Function: collect-flows
//
// Recolecta el caudal actual (m³/s) de las estaciones en flow_stations desde
// HIDROlínea DGA (https://snia.mop.gob.cl/sat/), el servicio público oficial
// del MOP para ciudadanos — sin login ni captcha. El flujo replica lo que hace
// el visor en el navegador:
//   1. GET  mapas.xhtml                  → cookie de sesión + ViewState JSF
//   2. POST búsqueda (fluviométricas)    → ViewState actualizado
//   3. Por estación: AJAX parcial JSF    → popup con `ultimoCaudalReg`
//
// Se ejecuta cada hora vía pg_cron (ver supabase/river_flows.sql). Las
// lecturas se upsertean con is_sample=false, sobrescribiendo cualquier dato
// de ejemplo de la misma hora.
//
// Cortesía con el servidor DGA: peticiones por estación en serie con una
// pausa corta — ~19 requests/hora en total.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BASE = 'https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml';
const AJAX_SOURCE = 'medicionesByTypeFunctions:j_idt162';

function extractViewState(html: string): string | null {
  return html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)?.[1]
    ?? html.match(/ViewState[^>]*><!\[CDATA\[([^\]]+)\]\]/)?.[1]
    ?? null;
}

function extractCookies(res: Response): string {
  const cookies: string[] = [];
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') cookies.push(v.split(';')[0]);
  }
  return cookies.join('; ');
}

async function fetchStationFlow(cookie: string, viewState: string, code: string): Promise<number | null> {
  const body = new URLSearchParams({
    'medicionesByTypeFunctions': 'medicionesByTypeFunctions',
    'javax.faces.ViewState': viewState,
    'javax.faces.source': AJAX_SOURCE,
    'javax.faces.partial.ajax': 'true',
    'javax.faces.partial.execute': `${AJAX_SOURCE} @component`,
    'javax.faces.partial.render': '@component',
    'param1': code,
    'param2': 'Fluviometricas',
    'org.richfaces.ajax.component': AJAX_SOURCE,
    [AJAX_SOURCE]: AJAX_SOURCE,
    'AJAX:EVENTS_COUNT': '1',
    'incId': '1',
  });
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Cookie': cookie, 'Faces-Request': 'partial/ajax', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  });
  const xml = await res.text();
  const raw = xml.match(/ultimoCaudalReg = "([^"]*)"/)?.[1];
  if (!raw) return null;
  // Formato chileno: coma decimal, punto de miles ("1.234,56")
  const num = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // 1. Sesión + ViewState
    const page = await fetch(BASE);
    const cookie = extractCookies(page);
    let viewState = extractViewState(await page.text());
    if (!viewState) throw new Error('No se encontró ViewState inicial');

    // 2. Búsqueda de fluviométricas con parámetro Caudal (fija el estado de la vista)
    const search = await fetch(BASE, {
      method: 'POST',
      headers: { 'Cookie': cookie, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({
        'searchForm': 'searchForm',
        'searchForm:regionInput': '',
        'searchForm:cuencaInput': '',
        'searchForm:tipoEstacionInput': '1',
        'searchForm:fuenteOrigenEstacionInput': '3',
        'searchForm:parametroInput': '12',
        'searchForm:buttonSearch': 'Buscar',
        'javax.faces.ViewState': viewState,
      }),
    });
    viewState = extractViewState(await search.text()) ?? viewState;

    // 3. Caudal por estación
    const { data: stations, error: stErr } = await supabase
      .from('flow_stations').select('code').eq('active', true);
    if (stErr) throw stErr;

    const ts = new Date();
    ts.setMinutes(0, 0, 0); // lectura asignada a la hora en curso

    const results: Record<string, number | null> = {};
    for (const { code } of stations ?? []) {
      try {
        results[code] = await fetchStationFlow(cookie, viewState, code);
      } catch {
        results[code] = null;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    const rows = Object.entries(results)
      .filter(([, flow]) => flow !== null)
      .map(([code, flow]) => ({
        station_code: code,
        ts: ts.toISOString(),
        flow,
        is_sample: false,
      }));

    if (rows.length > 0) {
      // upsert con update: si el generador de ejemplo ya escribió esta hora,
      // el dato real lo sobrescribe.
      const { error: upErr } = await supabase
        .from('flow_readings')
        .upsert(rows, { onConflict: 'station_code,ts' });
      if (upErr) throw upErr;
    }

    const failed = Object.entries(results).filter(([, f]) => f === null).map(([c]) => c);
    console.log(`[collect-flows] ok=${rows.length} sin_dato=${failed.length}`, failed.length ? failed : '');
    return new Response(JSON.stringify({ collected: rows.length, missing: failed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[collect-flows]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
