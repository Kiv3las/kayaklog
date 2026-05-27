import { Day, Lap, River } from './types';
import { isoFromDate, mondayOf, addDaysToISO, monthName } from './dates';
import { addDays, addWeeks, addMonths, addYears, startOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear } from 'date-fns';

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
  const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
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
  const result: BarDataItem[] = [];
  let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  let weekNum = 1;

  while (weekStart <= endOfMonth(monthStart)) {
    const weekEnd = addDays(weekStart, 6);
    const weekDays = days.filter((d) => {
      const iso = d.date;
      return iso >= isoFromDate(weekStart) && iso <= isoFromDate(weekEnd);
    });
    let km = 0;
    for (const day of weekDays) {
      for (const river of day.rivers) {
        for (const lap of river.laps) km += lap.km;
      }
    }
    result.push({ label: `S${weekNum}`, value: Math.round(km * 10) / 10 });
    weekStart = addDays(weekStart, 7);
    weekNum++;
    if (weekNum > 5) break;
  }
  return result;
}

export function yearBarData(days: Day[], year: number, upToMonth = 12): BarDataItem[] {
  return Array.from({ length: upToMonth }, (_, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
    const monthDays = days.filter((d) => d.date.startsWith(prefix));
    let km = 0;
    for (const day of monthDays) {
      for (const river of day.rivers) {
        for (const lap of river.laps) km += lap.km;
      }
    }
    return { label: monthName(i + 1), value: Math.round(km * 10) / 10 };
  });
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
  const map = new Map<string, RiverStat>();

  for (const day of days) {
    for (const river of day.rivers) {
      const key = `${river.name}||${river.country}`;
      const existing = map.get(key);
      let km = 0, timeMin = 0, laps = 0, stars = 0, ratedLaps = 0;
      for (const lap of river.laps) {
        km += lap.km;
        timeMin += lap.hours * 60 + lap.minutes;
        laps++;
        if (lap.stars > 0) { stars += lap.stars; ratedLaps++; }
      }
      const newSections = river.laps.map(l => l.section).filter((s): s is string => !!s && s !== '' && s !== 'todo');
      if (existing) {
        existing.km += km;
        existing.timeMinutes += timeMin;
        existing.laps += laps;
        existing.avgRating = ratedLaps > 0
          ? (existing.avgRating * existing.laps + stars) / (existing.laps + ratedLaps)
          : existing.avgRating;
        for (const s of newSections) {
          if (!existing.sections.includes(s)) existing.sections.push(s);
        }
      } else {
        map.set(key, {
          name: river.name,
          country: river.country,
          difficulty: river.laps[0]?.difficulty ?? 'III',
          sections: [...new Set(newSections)],
          km: Math.round(km * 10) / 10,
          laps,
          timeMinutes: timeMin,
          avgRating: ratedLaps > 0 ? Math.round((stars / ratedLaps) * 10) / 10 : 0,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.km - a.km);
}
