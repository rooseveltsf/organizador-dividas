export const MAX_SERIES_LENGTH = 120;

export function parseCalendarDate(value: string): Date {
  // Vencimentos e pagamentos são dias civis. A hora serve apenas ao armazenamento DateTime.
  return new Date(value.slice(0, 10) + 'T12:00:00.000Z');
}

export function calendarDay(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calendarMonthRange(yearMonth: string): { gte: Date; lte: Date } {
  const gte = parseCalendarDate(yearMonth + '-01');
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(gte);
  lte.setUTCMonth(lte.getUTCMonth() + 1, 0);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months + 1, 0);
  result.setUTCDate(Math.min(day, result.getUTCDate()));
  return result;
}

export function civilPeriod(value: string | null | undefined) {
  if (typeof value !== 'string') return undefined;
  const period = value.split('T')[0];
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(period)) return undefined;
  const day = period.length === 7 ? period + '-01' : period;
  const parsed = parseCalendarDate(day);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? period : undefined;
}

export function periodEnd(period: string) {
  return period.length === 7 ? calendarMonthRange(period).lte.toISOString().slice(0, 10) : period;
}

export function shiftCivilDay(day: string, offset: number) {
  const date = parseCalendarDate(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
