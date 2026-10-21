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
// pausa corta — ~26 requests/hora en total.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BASE = 'https://snia.mop.gob.cl/sat/site/informes/mapas/mapas.xhtml';
const AJAX_SOURCE = 'medicionesByTypeFunctions:j_idt162';

// Desde 2026-07-29 HIDROlínea responde 403 al User-Agent por defecto de Deno
// ("Deno/x.y.z"), que fue lo que detuvo la recolección. Nos identificamos con
// el nombre de la app + URL + contacto: es la práctica cortés para un cliente
// automatizado y permite a la DGA ubicarnos si nuestro tráfico les molesta
// (son ~20 peticiones/hora sobre un servicio público sin login ni captcha).
const USER_AGENT = 'KayakLog/1.1 (+https://kiv3las.github.io/kayaklog/; kilian@ivelic.cl)';

// Las edge functions mueren a los 150 s de tiempo de pared. Con las
// estaciones en serie una corrida tarda 70–130 s según cómo responda la DGA,
// y a veces más: el upsert iba al final, así que una corrida que tocaba el
// límite perdía la hora completa (10 horas perdidas entre el 6 y el 20 de
// octubre de 2026). Pasado este plazo no se empiezan estaciones nuevas.
const DEADLINE_MS = 130_000;
// Ninguna petición puede colgar la corrida: sin plazo propio, una respuesta
// trabada de la DGA se comería el margen hasta el límite de 150 s. Una
// estación tarda ~3 s; la página inicial (2 MB) y la búsqueda, 15–20 s.
const STATION_TIMEOUT_MS = 15_000;
const PAGE_TIMEOUT_MS = 45_000;

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
    headers: {
      'Cookie': cookie,
      'Faces-Request': 'partial/ajax',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': USER_AGENT,
    },
    body,
    signal: AbortSignal.timeout(STATION_TIMEOUT_MS),
  });
  const xml = await res.text();
  // Sin el marcador la respuesta está rota (no es "estación sin dato", que
  // trae el marcador vacío): lanzar para que el llamador reintente.
  const match = xml.match(/ultimoCaudalReg = "([^"]*)"/);
  if (!match) throw new Error(`Respuesta sin ultimoCaudalReg (HTTP ${res.status}, ${xml.length} bytes)`);
  const raw = match[1];
  if (!raw) return null;
  // Formato chileno: coma decimal, punto de miles ("1.234,56")
  const num = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

Deno.serve(async (_req) => {
  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // 1. Sesión + ViewState
    const page = await fetch(BASE, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    const html = await page.text();
    const cookie = extractCookies(page);
    let viewState = extractViewState(html);
    if (!viewState) {
      // Distinguir "nos bloquearon" de "cambió el HTML": son fallas con
      // arreglos distintos y el mensaje genérico costó días de diagnóstico.
      throw new Error(
        `No se encontró ViewState inicial (HTTP ${page.status}, ${html.length} bytes). ` +
        (page.ok ? 'La página respondió pero cambió su estructura.' : 'La DGA rechazó la petición.'),
      );
    }

    // 2. Búsqueda de fluviométricas con parámetro Caudal (fija el estado de la
    // vista). Cuesta ~15 s, pero es necesaria: probado 2026-10-20, sin ella
    // el popup devuelve vacío en 1 de cada 4 estaciones.
    const search = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
      },
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
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    viewState = extractViewState(await search.text()) ?? viewState;

    // 3. Caudal por estación
    const { data: stations, error: stErr } = await supabase
      .from('flow_stations').select('code').eq('active', true).order('sort_order');
    if (stErr) throw stErr;

    const ts = new Date();
    ts.setMinutes(0, 0, 0); // lectura asignada a la hora en curso

    // Orden rotado por hora: si una corrida lenta llega al plazo, las
    // estaciones que quedan fuera cambian de hora en hora en vez de ser
    // siempre las del final del catálogo (Patagonia).
    const list = stations ?? [];
    const offset = ts.getUTCHours() % Math.max(list.length, 1);
    const ordered = [...list.slice(offset), ...list.slice(0, offset)];

    let collected = 0;
    let writeErrors = 0;
    const missing: string[] = [];
    const skipped: string[] = [];
    for (const { code } of ordered) {
      if (Date.now() - startedAt > DEADLINE_MS) { skipped.push(code); continue; }

      // HIDROlínea falla de forma intermitente: corta la conexión HTTP/2
      // (GOAWAY) tras ~24 peticiones, a veces devuelve una respuesta rota y a
      // veces un valor vacío que un minuto después sí trae el dato (Mayer,
      // 2026-10-20). Rotas: hasta 3 intentos. Vacías: un reintento, que
      // distingue el vacío pasajero de la estación que de verdad no transmite
      // (Bravo) sin gastarle más tiempo.
      let flow: number | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (attempt > 1 && Date.now() - startedAt > DEADLINE_MS) break;
        try {
          flow = await fetchStationFlow(cookie, viewState, code);
          if (flow !== null || attempt >= 2) break;
        } catch (err) {
          if (attempt === 3) { console.warn(`[collect-flows] ${code}: ${err}`); break; }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (flow === null) {
        missing.push(code);
      } else {
        // Guardar al tiro, no al final: si la función muere por el límite de
        // tiempo, lo ya leído queda. Upsert: si la hora ya tenía dato (p. ej.
        // del generador de ejemplo), el real lo sobrescribe.
        const { error: upErr } = await supabase
          .from('flow_readings')
          .upsert({ station_code: code, ts: ts.toISOString(), flow, is_sample: false }, { onConflict: 'station_code,ts' });
        if (upErr) {
          console.warn(`[collect-flows] ${code}: upsert ${upErr.message}`);
          writeErrors++;
          missing.push(code);
        } else {
          collected++;
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    const secs = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `[collect-flows] ok=${collected} sin_dato=${missing.length} sin_tiempo=${skipped.length} ${secs}s`,
      missing.length || skipped.length ? { missing, skipped } : '',
    );
    // Un error de escritura es falla nuestra, no "la DGA no tenía dato":
    // responder 500 para que no se confunda con una corrida sana.
    return new Response(JSON.stringify({ collected, missing, skipped, writeErrors, seconds: secs }), {
      status: writeErrors > 0 ? 500 : 200,
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
