import { addMonths, calendarDay, parseCalendarDate } from '@organizador/shared';

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function shiftMonth(month: string, offset: number): string {
  return addMonths(parseCalendarDate(month + '-01'), offset).toISOString().slice(0, 7);
}

export function firstFutureMonth(today = new Date()): string {
  return shiftMonth(calendarDay(today).slice(0, 7), 1);
}

export function monthLabel(month: string): string {
  return MONTH_NAMES[Number(month.slice(5)) - 1] + ' de ' + month.slice(0, 4);
}

export function formatDate(date: string): string {
  const parts = date.split('T')[0].split('-');
  return parts.length === 3 ? parts.reverse().join('/') : date;
}
