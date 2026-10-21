import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Day, WaterLevel } from './types';
import { isoFromDate } from './dates';

// La clave incluye el proyecto Supabase: si el mismo build cambia de entorno
// (dev ↔ prod vía .env), la caché de uno no debe aparecer en el otro.
const PROJECT_REF = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
  .replace(/^https?:\/\//, '')
  .split('.')[0];
const FLOWS_CACHE_KEY = `kayak_flows_cache_v1_${PROJECT_REF}`;

// Caudales de ríos chilenos. Las estaciones son un catálogo curado (tabla
// flow_stations, solo lectura desde la app) y las lecturas llegan por un
// colector server-side, así que aquí solo hay consultas.

export interface FlowStation {
  code: string;        // código BNA de la estación DGA
  name: string;        // nombre oficial de la estación
  riverName: string;   // nombre corto del río mostrado en la app
  region: string;
  lat: number | null;
  lng: number | null;
  // Umbrales m³/s (bajo < medio < alto < crecida), calibrados con conocimiento
  // local. NULL cuando el río aún no tiene calibración: la app muestra el
  // caudal sin clasificar nivel.
  thrMedio: number | null;
  thrAlto: number | null;
  thrCrecida: number | null;
}

export interface FlowReading {
  ts: string;          // ISO timestamp
  flow: number;        // m³/s
  isSample: boolean;
}

export interface StationCurrent {
  station: FlowStation;
  latest: FlowReading | null;
  // Lectura ~24 h antes de la última, para calcular tendencia.
  dayAgo: FlowReading | null;
  // Serie de las últimas ~26 h (ascendente), para sparklines.
  series: FlowReading[];
}

export function classifyFlow(station: FlowStation, flow: number): WaterLevel | null {
  if (station.thrMedio === null || station.thrAlto === null || station.thrCrecida === null) return null;
  if (flow >= station.thrCrecida) return 'crecida';
  if (flow >= station.thrAlto) return 'alto';
  if (flow >= station.thrMedio) return 'medio';
  return 'bajo';
}

export type FlowTrend = 'up' | 'down' | 'flat';

// ±5% para no mostrar flechas con el ruido normal del sensor.
export function flowTrend(latest: number, dayAgo: number): FlowTrend {
  if (dayAgo <= 0) return 'flat';
  const change = (latest - dayAgo) / dayAgo;
  if (change > 0.05) return 'up';
  if (change < -0.05) return 'down';
  return 'flat';
}

// Cambio en 24 h como porcentaje entero (+12, -8), o null sin referencia.
export function flowChangePct(latest: number, dayAgo: number): number | null {
  if (dayAgo <= 0) return null;
  return Math.round(((latest - dayAgo) / dayAgo) * 100);
}

interface StationRow {
  code: string;
  name: string;
  river_name: string;
  region: string;
  lat: number | null;
  lng: number | null;
  thr_medio: number | null;
  thr_alto: number | null;
  thr_crecida: number | null;
}

function toStation(r: StationRow): FlowStation {
  return {
    code: r.code,
    name: r.name,
    riverName: r.river_name,
    region: r.region,
    lat: r.lat,
    lng: r.lng,
    thrMedio: r.thr_medio === null ? null : Number(r.thr_medio),
    thrAlto: r.thr_alto === null ? null : Number(r.thr_alto),
    thrCrecida: r.thr_crecida === null ? null : Number(r.thr_crecida),
  };
}

const FLOWS_TIMEOUT_MS = 12_000;

// Rechaza si la promesa no resuelve en `ms`. No cancela la consulta de fondo
// (no hace falta: su resultado se descarta), solo garantiza que la UI avance.
// Acepta PromiseLike porque los builders de PostgREST son "thenables", no
// promesas: se pueden esperar con await pero no tienen .catch/.finally.
function withTimeout<T>(promise: PromiseLike<T>, ms = FLOWS_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Caudales: sin respuesta en ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// Estaciones activas + última lectura + lectura de hace ~24 h. Si la red
// falla, devuelve el último resultado cacheado en el dispositivo: para un
// kayakista camino al río, "hace 3 horas iba en 80 m³/s" vale más que un
// error (la antigüedad se ve en el "hace X" de cada tarjeta).
export async function fetchStationsWithLatest(): Promise<StationCurrent[]> {
  try {
    // Camino rápido: la RPC flow_board trae todo en UNA llamada compacta.
    // Si no existe en este entorno, caer al camino de dos consultas.
    // El timeout es la red de seguridad del tablero: si la consulta se cuelga
    // (cliente supabase trabado, respuesta que no llega), preferimos mostrar
    // la caché o el error con reintento antes que un spinner infinito.
    const result = await withTimeout(
      fetchBoardRpc().catch(() => fetchStationsWithLatestRemote()),
    );
    // Un catálogo vacío NUNCA es un resultado legítimo: flow_stations es un
    // catálogo fijo (24 estaciones). Si llega [], la consulta salió sin sesión válida y RLS
    // filtró todo — PostgREST responde 200, no error, así que sin este chequeo
    // el tablero mostraría "sin estaciones" en silencio, sin reintento. Visto
    // en producción el 2026-08-27: al arrancar, dos cargas en paralelo y la que
    // gana puede salir antes de que la sesión esté lista (en `days` eso mismo
    // devolvió 401). Tratarlo como falla deja actuar a la caché y al reintento.
    if (result.length === 0) {
      throw new Error('Caudales: respuesta vacía (sesión no lista o sin permisos)');
    }
    void AsyncStorage.setItem(FLOWS_CACHE_KEY, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (err) {
    const cached = await loadCachedStations();
    if (cached) return cached;
    throw err;
  }
}

// Último tablero conocido, para render inmediato (stale-while-revalidate).
// Vacío o corrupto cuenta como "sin caché".
export async function loadCachedStations(): Promise<StationCurrent[] | null> {
  try {
    const raw = await AsyncStorage.getItem(FLOWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StationCurrent[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

interface BoardRow extends StationRow {
  is_sample: boolean;
  series: [number, number][]; // [epoch segundos, caudal]
}

async function fetchBoardRpc(): Promise<StationCurrent[]> {
  const { data, error } = await supabase.rpc('flow_board');
  if (error) throw error;
  const rows = (data ?? []) as BoardRow[];
  return rows.map((row) => {
    const series: FlowReading[] = row.series.map(([epoch, flow]) => ({
      ts: new Date(epoch * 1000).toISOString(),
      flow: Number(flow),
      isSample: row.is_sample,
    }));
    return buildCurrent(toStation(row), series);
  });
}

// Deriva última lectura y lectura de ~24 h atrás desde la serie de 26 h.
function buildCurrent(station: FlowStation, series: FlowReading[]): StationCurrent {
  const latest = series.length > 0 ? series[series.length - 1] : null;
  let dayAgo: FlowReading | null = null;
  if (latest) {
    const target = new Date(latest.ts).getTime() - 24 * 3600_000;
    let best = Infinity;
    for (const r of series) {
      const d = Math.abs(new Date(r.ts).getTime() - target);
      if (d < best) { best = d; dayAgo = r; }
    }
    // Si la lectura más cercana a "hace 24 h" está a menos de 20 h de la
    // última, la serie es demasiado corta para hablar de tendencia diaria.
    if (dayAgo && new Date(latest.ts).getTime() - new Date(dayAgo.ts).getTime() < 20 * 3600_000) {
      dayAgo = null;
    }
  }
  return { station, latest, dayAgo, series };
}

async function fetchStationsWithLatestRemote(): Promise<StationCurrent[]> {
  const { data: stations, error: stErr } = await supabase
    .from('flow_stations')
    .select('code, name, river_name, region, lat, lng, thr_medio, thr_alto, thr_crecida')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (stErr) throw stErr;

  const since = new Date(Date.now() - 26 * 3600_000).toISOString();
  const { data: readings, error: rdErr } = await supabase
    .from('flow_readings')
    .select('station_code, ts, flow, is_sample')
    .gte('ts', since)
    .order('ts', { ascending: true });
  if (rdErr) throw rdErr;

  const byStation = new Map<string, FlowReading[]>();
  for (const r of readings ?? []) {
    const list = byStation.get(r.station_code) ?? [];
    list.push({ ts: r.ts, flow: Number(r.flow), isSample: r.is_sample });
    byStation.set(r.station_code, list);
  }

  return (stations ?? []).map((row) => buildCurrent(toStation(row), byStation.get(row.code) ?? []));
}

export async function fetchStation(code: string): Promise<FlowStation | null> {
  const { data, error } = await withTimeout(supabase
    .from('flow_stations')
    .select('code, name, river_name, region, lat, lng, thr_medio, thr_alto, thr_crecida')
    .eq('code', code)
    .maybeSingle());
  if (error || !data) return null;
  return toStation(data);
}

// Empareja un río del registro personal con una estación de caudales por
// nombre: sin tildes ni mayúsculas, ignorando el paréntesis aclaratorio de la
// estación ("Trancura (Puesco)" → base "trancura"). Prefiere el match exacto;
// el apodo entre paréntesis también cuenta como exacto ("Dirty Toilet",
// "Ojos del Caburgua").
export function normalizeRiverName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function matchStationForRiver(items: StationCurrent[], riverName: string): StationCurrent | null {
  const target = normalizeRiverName(riverName);
  if (!target) return null;
  let nicknamed: StationCurrent | null = null;
  let partial: StationCurrent | null = null;
  for (const item of items) {
    const full = normalizeRiverName(item.station.riverName);
    const base = normalizeRiverName(item.station.riverName.replace(/\s*\(.*\)\s*$/, ''));
    const nickname = normalizeRiverName(item.station.riverName.match(/\(([^)]*)\)\s*$/)?.[1] ?? '');
    if (full === target) return item;
    if (!nicknamed && nickname === target) nicknamed = item;
    if (!partial && (base === target || base.startsWith(target) || target.startsWith(base))) partial = item;
  }
  return nicknamed ?? partial;
}

// ── Detalle de estación ─────────────────────────────────────────────────────

export interface FlowDaily {
  day: string;  // YYYY-MM-DD, fecha de Chile
  avg: number;
  min: number;
  max: number;
}

export interface FlowForecastDay {
  day: string;               // YYYY-MM-DD, fecha de Chile
  flow: number | null;       // estimado; null si el río no tiene pronóstico de caudal
  precipMm: number | null;
  tempMax: number | null;
}

export interface StationDetail {
  station: FlowStation;
  hourly: FlowReading[];          // últimos 7 días, ascendente
  daily: FlowDaily[];             // todo el historial, un punto por día
  forecast: FlowForecastDay[];    // de hoy en adelante
  forecastIssuedAt: string | null;
  hasFlowForecast: boolean;
}

const DETAIL_CACHE_PREFIX = `kayak_flow_detail_v1_${PROJECT_REF}_`;

interface DetailRow extends StationRow {
  has_flow_forecast: boolean;
  hourly: [number, number][];
  daily: [string, number, number, number][];
  forecast: [string, number | null, number | null, number | null][];
  forecast_issued_at: string | null;
}

const numOrNull = (v: number | string | null) => (v === null ? null : Number(v));

async function fetchDetailRpc(code: string): Promise<StationDetail> {
  const { data, error } = await supabase.rpc('flow_station_detail', { p_code: code });
  if (error) throw error;
  // Los códigos vienen del catálogo, así que null casi siempre es sesión no
  // lista (RLS filtra todo, ver fetchStationsWithLatest): tratarlo como falla
  // para que actúen la caché y el reintento.
  if (!data) throw new Error('Caudales: detalle vacío (sesión no lista o sin permisos)');
  const row = data as DetailRow;
  return {
    station: toStation(row),
    hourly: row.hourly.map(([epoch, flow]) => ({
      ts: new Date(epoch * 1000).toISOString(), flow: Number(flow), isSample: false,
    })),
    daily: row.daily.map(([day, avg, min, max]) => ({
      day, avg: Number(avg), min: Number(min), max: Number(max),
    })),
    forecast: row.forecast.map(([day, flow, precip, tmax]) => ({
      day, flow: numOrNull(flow), precipMm: numOrNull(precip), tempMax: numOrNull(tmax),
    })),
    forecastIssuedAt: row.forecast_issued_at,
    hasFlowForecast: row.has_flow_forecast,
  };
}

// Entornos sin la RPC (migración aún no aplicada): el detalle de antes, solo
// con 7 días horarios. Los promedios diarios se derivan de esa serie.
async function fetchDetailFallback(code: string): Promise<StationDetail> {
  const [station, hourly] = await Promise.all([fetchStation(code), fetchStationHistory(code, 7)]);
  if (!station) throw new Error('Caudales: estación no encontrada');
  const byDay = new Map<string, number[]>();
  for (const r of hourly) {
    const day = isoFromDate(new Date(r.ts));
    byDay.set(day, [...(byDay.get(day) ?? []), r.flow]);
  }
  const daily = Array.from(byDay.entries()).map(([day, flows]) => ({
    day,
    avg: flows.reduce((a, b) => a + b, 0) / flows.length,
    min: Math.min(...flows),
    max: Math.max(...flows),
  }));
  return { station, hourly, daily, forecast: [], forecastIssuedAt: null, hasFlowForecast: false };
}

// Detalle completo de una estación, con la misma red de seguridad que el
// tablero: timeout y, si la red falla, el último detalle visto en el
// dispositivo (útil camino al río, sin señal).
export async function fetchStationDetail(code: string): Promise<StationDetail> {
  try {
    const detail = await withTimeout(fetchDetailRpc(code).catch(() => fetchDetailFallback(code)));
    void AsyncStorage.setItem(DETAIL_CACHE_PREFIX + code, JSON.stringify(detail)).catch(() => {});
    return detail;
  } catch (err) {
    const cached = await loadCachedDetail(code);
    if (cached) return cached;
    throw err;
  }
}

export async function loadCachedDetail(code: string): Promise<StationDetail | null> {
  try {
    const raw = await AsyncStorage.getItem(DETAIL_CACHE_PREFIX + code);
    return raw ? (JSON.parse(raw) as StationDetail) : null;
  } catch {
    return null;
  }
}

// Caudal DGA de un día del registro: promedio de las lecturas de esa fecha
// local; null si no hay (antes de que existiera el colector, o la estación
// no transmitió).
export async function fetchDayFlow(code: string, dateISO: string): Promise<number | null> {
  const [y, m, d] = dateISO.split('-').map(Number);
  const { data, error } = await withTimeout(supabase
    .from('flow_readings')
    .select('flow')
    .eq('station_code', code)
    .gte('ts', new Date(y, m - 1, d).toISOString())
    .lt('ts', new Date(y, m - 1, d + 1).toISOString()));
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data.reduce((acc, r) => acc + Number(r.flow), 0) / data.length;
}

// ── Tus bajadas ─────────────────────────────────────────────────────────────

export interface Paddle {
  date: string;          // Day.date
  section?: string;
  stars: number;
  flow?: number;         // caudal anotado en el lap, si lo hay
}

// Laps del registro personal cuyo río corresponde a esta estación. Usa el
// mismo emparejamiento que la tarjeta "Caudal ahora" del río (solo Chile:
// las estaciones son de la DGA), contra el catálogo completo para respetar
// la preferencia por el match exacto.
export function paddlesForStation(days: Day[], items: StationCurrent[], code: string): Paddle[] {
  const matchCache = new Map<string, string | null>();
  const out: Paddle[] = [];
  for (const day of days) {
    for (const river of day.rivers) {
      if (river.country !== 'CL') continue;
      if (!matchCache.has(river.name)) {
        matchCache.set(river.name, matchStationForRiver(items, river.name)?.station.code ?? null);
      }
      if (matchCache.get(river.name) !== code) continue;
      for (const lap of river.laps) {
        out.push({ date: day.date, section: lap.section || undefined, stars: lap.stars, flow: lap.flow });
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchStationHistory(code: string, days = 7): Promise<FlowReading[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await withTimeout(supabase
    .from('flow_readings')
    .select('ts, flow, is_sample')
    .eq('station_code', code)
    .gte('ts', since)
    .order('ts', { ascending: true }));
  if (error) throw error;
  return (data ?? []).map((r) => ({ ts: r.ts, flow: Number(r.flow), isSample: r.is_sample }));
}
