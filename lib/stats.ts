import { Day, Lap, River } from './types';
import { isoFromDate, mondayOf, addDaysToISO, monthName } from './dates';
import { addDays, addWeeks, addMonths, addYears, startOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear } from 'date-fns';
import i18n from './i18n';

export interface PeriodStats {
  km: number;
  timeMinutes: number;
  laps: number;
  days: number;
  rivers: number;
  countries: number;
  avgRating: number;
}

function lapMinutes(lap: Lap): number {
  return lap.hours * 60 + lap.minutes;
}

function computeStats(days: Day[]): PeriodStats {
  let km = 0;
  let timeMinutes = 0;
  let laps = 0;
  let totalStars = 0;
  let ratedLaps = 0;
  const riverSet = new Set<string>();
  const countrySet = new Set<string>();

  for (const day of days) {
    for (const river of day.rivers) {
      riverSet.add(river.name);
      countrySet.add(river.country);
      for (const lap of river.laps) {
        km += lap.km;
        timeMinutes += lapMinutes(lap);
        laps++;
        if (lap.stars > 0) {
          totalStars += lap.stars;
          ratedLaps++;
        }
      }
    }
  }

  return {
    km: Math.round(km * 10) / 10,
    timeMinutes,
    laps,
    days: days.length,
    rivers: riverSet.size,
    countries: countrySet.size,
    avgRating: ratedLaps > 0 ? Math.round((totalStars / ratedLaps) * 10) / 10 : 0,
  };
}

export interface BarDataItem {
  label: string;
  value: number;
}

export function weekBarData(days: Day[], monday: Date): BarDataItem[] {
  const labels = i18n.t('days.short', { returnObjects: true }) as string[];
  return labels.map((label, i) => {
    const iso = isoFromDate(addDays(monday, i));
    const dayData = days.filter((d) => d.date === iso);
    let km = 0;
    for (const day of dayData) {
      for (const river of day.rivers) {
        for (const lap of river.laps) km += lap.km;
      }
    }
    return { label, value: Math.round(km * 10) / 10 };
  });
}

export function monthBarData(days: Day[], year: number, month: number): BarDataItem[] {
  const monthStart = new Date(year, month - 1, 1, 12);
  const monthEnd = endOfMonth(monthStart);
  const monthStartISO = isoFromDate(monthStart);
  const monthEndISO = isoFromDate(monthEnd);
  const result: BarDataItem[] = [];
  let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  let weekNum = 1;

  // Iterate every Monday until we pass the end of the month. Clamp each
  // week's date range to the actual month boundaries so days from adjacent
  // months don't bleed into S1 or the last week.
  while (weekStart <= monthEnd) {
    const weekEnd = addDays(weekStart, 6);
    const startISO = isoFromDate(weekStart);
    const endISO = isoFromDate(weekEnd);
    const effectiveStart = startISO < monthStartISO ? monthStartISO : startISO;
    const effectiveEnd = endISO > monthEndISO ? monthEndISO : endISO;
    let km = 0;
    for (const day of days) {
      if (day.date < effectiveStart || day.date > effectiveEnd) continue;
      for (const river of day.rivers) {
        for (const lap of river.laps) km += lap.km;
      }
    }
    result.push({ label: `S${weekNum}`, value: Math.round(km * 10) / 10 });
    weekStart = addDays(weekStart, 7);
    weekNum++;
  }
  return result;
}

export function yearBarData(days: Day[], year: number, upToMonth = 12): BarDataItem[] {
  const buckets = Array.from({ length: upToMonth }, (_, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
    let km = 0;
    for (const day of days) {
      if (!day.date.startsWith(prefix)) continue;
      for (const river of day.rivers) {
        for (const lap of river.laps) km += lap.km;
      }
    }
    return { month: i + 1, km: Math.round(km * 10) / 10 };
  });
  const firstWithData = buckets.findIndex((b) => b.km > 0);
  const visible = firstWithData === -1 ? buckets : buckets.slice(firstWithData);
  return visible.map((b) => ({ label: monthName(b.month), value: b.km }));
}

export function statsForDays(days: Day[]): PeriodStats {
  return computeStats(days);
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface RiverStat {
  name: string;
  country: string;
  difficulty: string;
  sections: string[];
  km: number;
  laps: number;
  timeMinutes: number;
  avgRating: number;
}

export function aggregateRivers(days: Day[]): RiverStat[] {
  interface Accum {
    name: string;
    country: string;
    difficulty: string;
    sections: Set<string>;
    km: number;
    laps: number;
    timeMinutes: number;
    totalStars: number;
    ratedLaps: number;
  }
  const map = new Map<string, Accum>();

  for (const day of days) {
    for (const river of day.rivers) {
      const key = `${river.name}||${river.country}`;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          name: river.name,
          country: river.country,
          difficulty: river.laps[0]?.difficulty ?? 'III',
          sections: new Set<string>(),
          km: 0, laps: 0, timeMinutes: 0,
          totalStars: 0, ratedLaps: 0,
        };
        map.set(key, acc);
      }
      for (const lap of river.laps) {
        acc.km += lap.km;
        acc.timeMinutes += lap.hours * 60 + lap.minutes;
        acc.laps++;
        if (lap.stars > 0) { acc.totalStars += lap.stars; acc.ratedLaps++; }
        if (lap.section && lap.section !== '' && lap.section !== 'todo') {
          acc.sections.add(lap.section);
        }
      }
    }
  }

  return Array.from(map.values())
    .map((a) => ({
      name: a.name,
      country: a.country,
      difficulty: a.difficulty,
      sections: Array.from(a.sections),
      km: Math.round(a.km * 10) / 10,
      laps: a.laps,
      timeMinutes: a.timeMinutes,
      avgRating: a.ratedLaps > 0 ? Math.round((a.totalStars / a.ratedLaps) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.km - a.km);
}
