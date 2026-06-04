export interface LatLng {
  lat: number;
  lng: number;
}

export interface SectionLoc {
  start?: LatLng;
  end?: LatLng;
}

export type WaterLevel = 'bajo' | 'medio' | 'alto' | 'crecida';

export interface Lap {
  km: number;
  hours: number;
  minutes: number;
  stars: number;
  note: string;
  difficulty?: Difficulty;
  section?: string;
  // Water level for this lap. `waterLevel` is the ordinal (comparable for
  // "most/least water"); `flow` is an optional precise reading in m³/s.
  waterLevel?: WaterLevel;
  flow?: number;
  // Legacy single put-in/take-out — kept for backward compatibility with
  // laps logged before per-section locations existed.
  startLocation?: LatLng;
  endLocation?: LatLng;
  // Per-section put-in/take-out, keyed by section name (Alto/Medio/Bajo or a
  // custom section). When present, supersedes startLocation/endLocation.
  sectionLocations?: Record<string, SectionLoc>;
}

export interface River {
  name: string;
  country: string;
  laps: Lap[];
}

export interface Day {
  id: number;
  date: string;
  notes: string;
  rivers: River[];
}

export interface Settings {
  notifEnabled: boolean;
  notifTime: string;
}

export type Difficulty = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export type FilterType =
  | { kind: 'all' }
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number };

export type StatsPeriodType = 'week' | 'month' | 'year';
