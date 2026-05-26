import { startOfWeek, format, addDays, differenceInCalendarDays, parseISO as dfnsParseISO } from 'date-fns';

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

export function formatDisplayDate(iso: string): string {
  return format(parseDateISO(iso), 'dd MMM yyyy');
}

export function formatMonthYear(year: number, month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[month - 1]} ${year}`;
}

export function monthName(month: number): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[month - 1];
}

export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const m = format(monday, 'dd MMM');
  const s = format(sunday, 'dd MMM yyyy');
  return `${m} – ${s}`;
}
