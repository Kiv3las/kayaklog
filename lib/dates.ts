import { startOfWeek, format, addDays, differenceInCalendarDays } from 'date-fns';
import i18n from './i18n';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function isoFromDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseDateISO(iso: string): Date {
  // Use noon to avoid TZ offset issues
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function daysBetween(iso1: string, iso2: string): number {
  return Math.abs(differenceInCalendarDays(parseDateISO(iso2), parseDateISO(iso1)));
}

export function addDaysToISO(iso: string, days: number): string {
  return isoFromDate(addDays(parseDateISO(iso), days));
}

function shortMonth(idx: number): string {
  return (i18n.t('months.short', { returnObjects: true }) as string[])[idx] ?? '';
}

export function formatDisplayDate(iso: string): string {
  const d = parseDateISO(iso);
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${shortMonth(d.getMonth())} ${d.getFullYear()}`;
}

export function formatMonthYear(year: number, month: number): string {
  const name = (i18n.t('months.long', { returnObjects: true }) as string[])[month - 1] ?? '';
  return `${name} ${year}`;
}

export function monthName(month: number): string {
  return shortMonth(month - 1);
}

export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const m = `${String(monday.getDate()).padStart(2, '0')} ${shortMonth(monday.getMonth())}`;
  const s = `${String(sunday.getDate()).padStart(2, '0')} ${shortMonth(sunday.getMonth())} ${sunday.getFullYear()}`;
  return `${m} – ${s}`;
}
