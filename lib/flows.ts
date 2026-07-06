import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { WaterLevel } from './types';

const FLOWS_CACHE_KEY = 'kayak_flows_cache_v1';

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

// Estaciones activas + última lectura + lectura de hace ~24 h. Si la red
// falla, devuelve el último resultado cacheado en el dispositivo: para un
// kayakista camino al río, "hace 3 horas iba en 80 m³/s" vale más que un
// error (la antigüedad se ve en el "hace X" de cada tarjeta).
export async function fetchStationsWithLatest(): Promise<StationCurrent[]> {
  try {
    const result = await fetchStationsWithLatestRemote();
    void AsyncStorage.setItem(FLOWS_CACHE_KEY, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (err) {
    try {
      const raw = await AsyncStorage.getItem(FLOWS_CACHE_KEY);
      if (raw) return JSON.parse(raw) as StationCurrent[];
    } catch { /* caché corrupta o ausente */ }
    throw err;
  }
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

  return (stations ?? []).map((row) => {
    const series = byStation.get(row.code) ?? [];
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
    return { station: toStation(row), latest, dayAgo, series };
  });
}

export async function fetchStation(code: string): Promise<FlowStation | null> {
  const { data, error } = await supabase
    .from('flow_stations')
    .select('code, name, river_name, region, lat, lng, thr_medio, thr_alto, thr_crecida')
    .eq('code', code)
    .maybeSingle();
  if (error || !data) return null;
  return toStation(data);
}

// Empareja un río del registro personal con una estación de caudales por
// nombre: sin tildes ni mayúsculas, ignorando el paréntesis aclaratorio de la
// estación ("Trancura (Puesco)" → base "trancura"). Prefiere el match exacto.
function normalizeRiverName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function matchStationForRiver(items: StationCurrent[], riverName: string): StationCurrent | null {
  const target = normalizeRiverName(riverName);
  if (!target) return null;
  let partial: StationCurrent | null = null;
  for (const item of items) {
    const full = normalizeRiverName(item.station.riverName);
    const base = normalizeRiverName(item.station.riverName.replace(/\s*\(.*\)\s*$/, ''));
    if (full === target) return item;
    if (!partial && (base === target || base.startsWith(target) || target.startsWith(base))) partial = item;
  }
  return partial;
}

export async function fetchStationHistory(code: string, days = 7): Promise<FlowReading[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('flow_readings')
    .select('ts, flow, is_sample')
    .eq('station_code', code)
    .gte('ts', since)
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ts: r.ts, flow: Number(r.flow), isSample: r.is_sample }));
}
