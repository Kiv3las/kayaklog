import { Day } from './types';
import { FilterType } from './types';
import i18n from './i18n';

export function applyFilter(days: Day[], filter: FilterType): Day[] {
  if (filter.kind === 'all') return days;
  if (filter.kind === 'year') {
    return days.filter((d) => d.date.startsWith(`${filter.year}`));
  }
  const prefix = `${filter.year}-${String(filter.month).padStart(2, '0')}`;
  return days.filter((d) => d.date.startsWith(prefix));
}

export function getAvailableYears(days: Day[]): number[] {
  const years = new Set(days.map((d) => Number(d.date.slice(0, 4))));
  return Array.from(years).sort((a, b) => b - a);
}

export function getAvailableMonthsForYear(days: Day[], year: number): number[] {
  const months = new Set(
    days
      .filter((d) => d.date.startsWith(`${year}`))
      .map((d) => Number(d.date.slice(5, 7)))
  );
  return Array.from(months).sort((a, b) => b - a);
}

export function filterLabel(filter: FilterType): string {
  if (filter.kind === 'all') return i18n.t('filter.allEntries');
  if (filter.kind === 'year') return `${filter.year}`;
  const months = i18n.t('months.long', { returnObjects: true }) as string[];
  return `${months[filter.month - 1]} ${filter.year}`;
}
