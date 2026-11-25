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
