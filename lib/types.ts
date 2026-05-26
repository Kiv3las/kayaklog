export interface LatLng {
  lat: number;
  lng: number;
}

export interface Lap {
  km: number;
  hours: number;
  minutes: number;
  stars: number;
  note: string;
}

export type RiverSection = 'alto' | 'medio' | 'bajo' | 'todo';

export interface River {
  name: string;
  country: string;
  difficulty: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  section?: RiverSection;
  laps: Lap[];
  startLocation?: LatLng;
  endLocation?: LatLng;
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
