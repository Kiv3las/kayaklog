// Supabase Edge Function: collect-forecasts
//
// Pronóstico de 16 días por estación, en flow_forecasts. Dos fuentes, ambas
// vía Open-Meteo (gratis, sin llave, licencia CC BY 4.0 — la app lo atribuye):
//   - Lluvia y temperatura máxima: Forecast API, en la coordenada de la estación.
//   - Caudal: GloFAS (Copernicus) por la Flood API, en la celda calibrada de
//     cada estación (flow_stations.glofas_lat/lng; ver river_flows.sql).
//
// GloFAS acierta la FORMA de la curva pero no la magnitud (Trancura: modela
// 148 m³/s cuando la DGA mide 181), así que el caudal se corrige con un factor
// = medido/modelado del día más reciente. El pronóstico queda anclado al
// valor real de hoy y sigue la tendencia del modelo. No considera
// represas ni extracciones: la app lo muestra como estimación.
//
// Se ejecuta dos veces al día vía pg_cron (ver supabase/river_flows.sql). Son
// 2 peticiones a Open-Meteo por corrida (todas las estaciones en una).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood';
const USER_AGENT = 'KayakLog/1.1 (+https://kiv3las.github.io/kayaklog/; kilian@ivelic.cl)';
const FORECAST_DAYS = 16;
// Ventana de lecturas DGA para el factor de corrección: si hoy aún no hay
// lecturas (o la celda no tiene dato hoy), se usa el día anterior más cercano.
const BIAS_DAYS = 4;
// Un factor fuera de este rango significa que la celda ya no representa al
// río (o que la estación midió algo anómalo): mejor sin caudal que uno falso.
const BIAS_MIN = 0.2;
const BIAS_MAX = 5;

interface Station {
  code: string;
  lat: number;
  lng: number;
  glofas_lat: number | null;
  glofas_lng: number | null;
}

interface DailyResponse {
  daily: { time: string[]; [variable: string]: (number | null)[] | string[] };
}

// Fecha de Chile (YYYY-MM-DD) de un instante: los días del pronóstico y los
// promedios de la DGA tienen que hablar del mismo día calendario.
const chileDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });

// Open-Meteo devuelve un objeto con una sola coordenada y un arreglo con varias.
async function openMeteo(url: string, coords: { lat: number; lng: number }[], params: Record<string, string>): Promise<DailyResponse[]> {
  const query = new URLSearchParams({
    latitude: coords.map((c) => c.lat).join(','),
    longitude: coords.map((c) => c.lng).join(','),
    ...params,
  });
  const res = await fetch(`${url}?${query}`, { headers: { 'User-Agent': USER_AGENT } });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(`Open-Meteo ${url}: HTTP ${res.status} ${json?.reason ?? ''}`);
  return Array.isArray(json) ? json : [json];
}

function byDay(resp: DailyResponse, variable: string): Map<string, number> {
  const out = new Map<string, number>();
  const values = resp.daily[variable] as (number | null)[];
  resp.daily.time.forEach((day, i) => {
    if (values[i] !== null && values[i] !== undefined) out.set(day, values[i] as number);
  });
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    const { data, error: stErr } = await supabase
      .from('flow_stations')
      .select('code, lat, lng, glofas_lat, glofas_lng')
      .eq('active', true)
      .not('lat', 'is', null);
    if (stErr) throw stErr;
    const stations = (data ?? []) as Station[];
    const withCell = stations.filter((s) => s.glofas_lat !== null && s.glofas_lng !== null);

    // Si una de las dos fuentes falla, se aborta sin escribir: el pronóstico
    // anterior queda intacto y la app muestra cuándo se emitió.
    const [weather, flood] = await Promise.all([
      openMeteo(FORECAST_URL, stations.map((s) => ({ lat: s.lat, lng: s.lng })), {
        daily: 'precipitation_sum,temperature_2m_max',
        timezone: 'America/Santiago',
        forecast_days: String(FORECAST_DAYS),
      }),
      withCell.length === 0 ? Promise.resolve([]) : openMeteo(
        FLOOD_URL,
        withCell.map((s) => ({ lat: s.glofas_lat!, lng: s.glofas_lng! })),
        { daily: 'river_discharge', past_days: String(BIAS_DAYS), forecast_days: String(FORECAST_DAYS) },
      ),
    ]);

    const now = new Date();
    const today = chileDate.format(now);
    const biasSince = new Date(now.getTime() - BIAS_DAYS * 86400_000);

    // Caudal modelado y factor de corrección por estación.
    const modeled = new Map<string, { flows: Map<string, number>; bias: number | null }>();
    for (const [i, s] of withCell.entries()) {
      const flows = byDay(flood[i], 'river_discharge');

      // Promedio DGA por día de Chile. Una consulta por estación: todas juntas
      // superarían el límite de 1000 filas de PostgREST.
      const { data: readings, error: rdErr } = await supabase
        .from('flow_readings')
        .select('ts, flow')
        .eq('station_code', s.code)
        .gte('ts', biasSince.toISOString());
      if (rdErr) throw rdErr;
      const sums = new Map<string, { sum: number; n: number }>();
      for (const r of readings ?? []) {
        const day = chileDate.format(new Date(r.ts));
        const acc = sums.get(day) ?? { sum: 0, n: 0 };
        acc.sum += Number(r.flow);
        acc.n += 1;
        sums.set(day, acc);
      }

      // El factor del día más reciente (normalmente hoy) ancla el pronóstico
      // al último valor medido: la curva sigue sin salto desde lo observado.
      // La mediana de varios días es más estable pero dejaba el día 0 hasta
      // 30% lejos de lo medido (Mayer: 80 vs 117) — un salto en el gráfico.
      let bias: number | null = null;
      for (const day of [...sums.keys()].sort().reverse()) {
        const model = flows.get(day);
        const { sum, n } = sums.get(day)!;
        if (model && model > 0) { bias = sum / n / model; break; }
      }
      if (bias !== null && (bias < BIAS_MIN || bias > BIAS_MAX)) {
        console.warn(`[collect-forecasts] ${s.code}: factor ${bias.toFixed(2)} fuera de rango, sin caudal`);
        bias = null;
      }
      modeled.set(s.code, { flows, bias });
    }

    const issuedAt = now.toISOString();
    const rows = stations.flatMap((s, i) => {
      const rain = byDay(weather[i], 'precipitation_sum');
      const tmax = byDay(weather[i], 'temperature_2m_max');
      const model = modeled.get(s.code);
      return weather[i].daily.time
        .filter((day) => day >= today)
        .map((day) => {
          const raw = model?.flows.get(day) ?? null;
          return {
            station_code: s.code,
            day,
            flow: raw !== null && model?.bias != null ? round1(raw * model.bias) : null,
            flow_raw: raw !== null ? round1(raw) : null,
            precip_mm: rain.get(day) ?? null,
            temp_max: tmax.get(day) ?? null,
            issued_at: issuedAt,
          };
        });
    });

    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from('flow_forecasts')
        .upsert(rows, { onConflict: 'station_code,day' });
      if (upErr) throw upErr;
    }

    const withFlow = [...modeled.values()].filter((m) => m.bias !== null).length;
    console.log(`[collect-forecasts] estaciones=${stations.length} con_caudal=${withFlow} filas=${rows.length}`);
    return new Response(JSON.stringify({ stations: stations.length, withFlow, rows: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[collect-forecasts]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
