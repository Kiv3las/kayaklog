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
  difficulty?: Difficulty;
  section?: string;
  startLocation?: LatLng;
  endLocation?: LatLng;
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
