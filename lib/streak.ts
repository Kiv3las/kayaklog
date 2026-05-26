import { Day } from './types';
import { todayISO, addDaysToISO } from './dates';

export function computeStreaks(days: Day[]): {
  current: number;
  longest: number;
  remoHoy: boolean;
} {
  if (days.length === 0) return { current: 0, longest: 0, remoHoy: false };

  const dateSet = new Set(days.map((d) => d.date));
  const today = todayISO();
  const remoHoy = dateSet.has(today);

  // Compute current streak
  let current = 0;
  let cursor = remoHoy ? today : addDaysToISO(today, -1);

  while (dateSet.has(cursor)) {
    current++;
    cursor = addDaysToISO(cursor, -1);
  }

  // Compute longest streak from all sorted dates
  const sorted = Array.from(dateSet).sort();
  let longest = 0;
  let runLen = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const expected = addDaysToISO(prev, 1);
    if (curr === expected) {
      runLen++;
    } else {
      if (runLen > longest) longest = runLen;
      runLen = 1;
    }
  }
  if (runLen > longest) longest = runLen;

  return { current, longest, remoHoy };
}
