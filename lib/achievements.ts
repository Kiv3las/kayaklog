import { Day, Difficulty } from './types';
import { computeStreaks } from './streak';

const DIFF_ORDER: Difficulty[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Class I → 1 … VI → 6, unknown/empty → 0. */
export function diffRank(d?: Difficulty): number {
  if (!d) return 0;
  const i = DIFF_ORDER.indexOf(d);
  return i === -1 ? 0 : i + 1;
}

/** Roman numeral for a rank (1..6). Index 0 is unused. */
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'] as const;

export interface Totals {
  km: number;
  days: number;
  laps: number;
  minutes: number;
  rivers: number;
  countries: number;
  longestStreak: number;
  hardestClassRank: number;
  hardestClass: Difficulty | null;
  longestDayKm: number;
  longestLapKm: number;
  bestMonthKm: number;
  bestMonth: string | null; // 'YYYY-MM'
  riverNames: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeTotals(days: Day[]): Totals {
  let km = 0;
  let minutes = 0;
  let laps = 0;
  let longestLapKm = 0;
  let hardestClassRank = 0;
  const riverSet = new Set<string>();
  const countrySet = new Set<string>();
  const monthKm = new Map<string, number>();
  let longestDayKm = 0;

  for (const day of days) {
    let dayKm = 0;
    for (const river of day.rivers) {
      riverSet.add(river.name);
      countrySet.add(river.country);
      for (const lap of river.laps) {
        km += lap.km;
        dayKm += lap.km;
        minutes += lap.hours * 60 + lap.minutes;
        laps++;
        if (lap.km > longestLapKm) longestLapKm = lap.km;
        const rank = diffRank(lap.difficulty);
        if (rank > hardestClassRank) hardestClassRank = rank;
      }
    }
    if (dayKm > longestDayKm) longestDayKm = dayKm;
    const month = day.date.slice(0, 7); // 'YYYY-MM'
    monthKm.set(month, (monthKm.get(month) ?? 0) + dayKm);
  }

  let bestMonth: string | null = null;
  let bestMonthKm = 0;
  for (const [month, total] of monthKm) {
    if (total > bestMonthKm) { bestMonthKm = total; bestMonth = month; }
  }

  const { longest } = computeStreaks(days);

  return {
    km: round1(km),
    days: days.length,
    laps,
    minutes,
    rivers: riverSet.size,
    countries: countrySet.size,
    longestStreak: longest,
    hardestClassRank,
    hardestClass: hardestClassRank > 0 ? DIFF_ORDER[hardestClassRank - 1] : null,
    longestDayKm: round1(longestDayKm),
    longestLapKm: round1(longestLapKm),
    bestMonthKm: round1(bestMonthKm),
    bestMonth,
    riverNames: Array.from(riverSet),
  };
}

export type CountCategory = 'distance' | 'days' | 'rivers' | 'countries' | 'streak' | 'class';
export type AchievementCategory = CountCategory | 'river';
export type AchievementGroup = 'allTime' | 'year' | 'river';

export interface Achievement {
  id: string;
  group: AchievementGroup;
  category: AchievementCategory;
  icon: string; // Ionicons name
  color: string;
  target: number; // threshold; for 'class' a rank 3..6; for 'river' always 1
  current: number;
  unlocked: boolean;
  name?: string; // legendary river display name (river group only)
}

// Decorative badge colors, intentionally theme-independent.
const CATEGORY_META: Record<CountCategory, { icon: string; color: string; metric: (t: Totals) => number }> = {
  distance: { icon: 'speedometer', color: '#0a84ff', metric: (t) => t.km },
  days: { icon: 'calendar', color: '#34c759', metric: (t) => t.days },
  rivers: { icon: 'water', color: '#5ac8fa', metric: (t) => t.rivers },
  countries: { icon: 'globe', color: '#bf5af2', metric: (t) => t.countries },
  streak: { icon: 'flame', color: '#ff9500', metric: (t) => t.longestStreak },
  class: { icon: 'trophy', color: '#ff453a', metric: (t) => t.hardestClassRank },
};

const ALL_TIME_ORDER: CountCategory[] = ['distance', 'days', 'rivers', 'countries', 'streak', 'class'];
const ALL_TIME_TARGETS: Record<CountCategory, number[]> = {
  distance: [10, 100, 500, 1000, 5000, 10000],
  days: [1, 10, 50, 100, 200, 300],
  rivers: [1, 5, 10, 15, 50, 100],
  countries: [1, 3],
  streak: [3, 7, 30],
  class: [3, 4, 5],
};

// Annual goals (measured within the current calendar year).
const YEAR_ORDER: CountCategory[] = ['rivers', 'days', 'distance'];
const YEAR_TARGETS: Partial<Record<CountCategory, number[]>> = {
  rivers: [10, 50, 100],
  days: [200, 300],
  distance: [5000, 10000],
};

const LEGEND_COLOR = '#ffb800';

// Iconic whitewater rivers. Display name as the user knows it; matched against
// the free-text river names they log, normalized so accents/casing/punctuation
// and "Río X" prefixes don't break the match.
export const LEGENDARY_RIVERS: string[] = [
  'Indus', 'Stikine', 'Bravo', 'Pascua', 'Baker', 'Rauma', 'Muksu', 'Sogndal',
  'Fuy', 'Fantasy Falls', 'Upper Cherry', 'Humla Karnali', 'Glomoga', 'Ikopa',
  'Bashkaus', 'Sary-Jaz', 'Zambezi', 'Futaleufú', 'Mayer', 'Cuervo', 'Claro',
  'Blanco', 'Trancura', 'Nevados', 'Palguín', 'Puesco', 'Puelo',
  'Little White Salmon', 'Kaituna', 'Keldua', 'Royal Gorge',
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface AchievementsResult {
  totals: Totals;
  sections: {
    rivers: Achievement[];
    yearly: Achievement[];
    allTime: Achievement[];
  };
  unlockedCount: number;
  total: number;
}

function sortByUnlock<T extends { unlocked: boolean }>(arr: T[]): T[] {
  // Stable: unlocked first, original order preserved within each partition.
  return [...arr].sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));
}

export function computeAchievements(days: Day[]): AchievementsResult {
  const totals = computeTotals(days);
  const year = new Date().getFullYear();
  const yearDays = days.filter((d) => d.date.startsWith(`${year}`));
  const yearTotals = computeTotals(yearDays);

  // All-time milestones
  const allTime: Achievement[] = [];
  for (const cat of ALL_TIME_ORDER) {
    const meta = CATEGORY_META[cat];
    const current = meta.metric(totals);
    for (const target of ALL_TIME_TARGETS[cat]) {
      allTime.push({
        id: `at-${cat}-${target}`,
        group: 'allTime',
        category: cat,
        icon: meta.icon,
        color: meta.color,
        target,
        current,
        unlocked: current >= target,
      });
    }
  }

  // Annual goals (current year)
  const yearly: Achievement[] = [];
  for (const cat of YEAR_ORDER) {
    const meta = CATEGORY_META[cat];
    const current = meta.metric(yearTotals);
    for (const target of YEAR_TARGETS[cat] ?? []) {
      yearly.push({
        id: `yr-${cat}-${target}`,
        group: 'year',
        category: cat,
        icon: meta.icon,
        color: meta.color,
        target,
        current,
        unlocked: current >= target,
      });
    }
  }

  // Legendary rivers
  const loggedNorm = totals.riverNames.map(norm).filter((n) => n.length >= 3);
  const rivers: Achievement[] = LEGENDARY_RIVERS.map((name) => {
    const key = norm(name);
    const unlocked = loggedNorm.some((n) => n.includes(key) || key.includes(n));
    return {
      id: `rv-${key.replace(/\s+/g, '-')}`,
      group: 'river' as const,
      category: 'river' as const,
      icon: 'medal',
      color: LEGEND_COLOR,
      target: 1,
      current: unlocked ? 1 : 0,
      unlocked,
      name,
    };
  });

  const sections = {
    rivers: sortByUnlock(rivers),
    yearly: sortByUnlock(yearly),
    allTime: sortByUnlock(allTime),
  };

  const all = [...sections.rivers, ...sections.yearly, ...sections.allTime];
  const unlockedCount = all.filter((a) => a.unlocked).length;
  return { totals, sections, unlockedCount, total: all.length };
}
