import { addMonths, civilPeriod, MAX_SERIES_LENGTH, parseCalendarDate, periodEnd } from './calendar';
import { installmentCents, toCents, validMoneyCents } from './money';
import { collectPurchaseSeries, projectPurchaseSeries, type PurchaseSeriesSummary, type RecurrenceAssumption } from './purchaseSeries';
import type { PurchaseTransaction } from './purchaseSimulation';

interface MonthlyPurchaseInput {
  profileId: string;
  today: string;
  total: number;
  firstDue: string;
  installments: number;
  margin?: number;
  recurrenceAssumptions?: ReadonlyMap<string, RecurrenceAssumption>;
}

export interface MonthlyPurchaseRow {
  month: string;
  income: bigint;
  expenses: bigint;
  received: bigint;
  paid: bigint;
  assumedIncome: bigint;
  assumedExpenses: bigint;
  purchase: bigint;
  purchaseDate?: string;
  withoutPurchase: bigint;
  withPurchase: bigint;
  belowMargin: boolean;
  missing: string[];
}

export interface MonthlyPurchase {
  rows: MonthlyPurchaseRow[];
  tightest: MonthlyPurchaseRow;
  firstNegative?: MonthlyPurchaseRow;
  series: PurchaseSeriesSummary[];
  relief: { key: string; month: string; description: string; cents: bigint }[];
}

export function simulateMonthlyPurchase(input: MonthlyPurchaseInput, transactions: readonly PurchaseTransaction[]): MonthlyPurchase | undefined {
  const { today, firstDue, installments, profileId, recurrenceAssumptions } = input;
  const cents = toCents(input.total);
  if (!validMoneyCents(cents) || !Number.isInteger(installments) || installments < 1 || installments > MAX_SERIES_LENGTH || cents < installments
    || today.length !== 10 || civilPeriod(today) !== today || firstDue.length !== 10 || civilPeriod(firstDue) !== firstDue || firstDue < today) return;

  const anchor = parseCalendarDate(firstDue);
  if (addMonths(anchor, installments - 1).getUTCFullYear() > 9999) return;
  const charges = new Map<string, { date: string; cents: bigint }>();
  for (let index = 0; index < installments; index++) {
    const date = addMonths(anchor, index).toISOString().slice(0, 10);
    charges.set(date.slice(0, 7), { date, cents: BigInt(installmentCents(cents, installments, index + 1)) });
  }
  const currentMonth = today.slice(0, 7);
  const start = parseCalendarDate(currentMonth + '-01');
  const minimumEnd = addMonths(start, 2);
  const lastMonth = addMonths(anchor, installments - 1).toISOString().slice(0, 7);
  const defaultEnd = minimumEnd.getUTCFullYear() > 9999 ? '9999-12' : minimumEnd.toISOString().slice(0, 7);
  const endMonth = lastMonth > defaultEnd ? lastMonth : defaultEnd;
  const registered = new Map<string, PurchaseTransaction[]>();
  const consideredDates = new Map<string, string>();
  const profileRows = transactions.filter(tx => tx.profileId === profileId);
  for (const tx of profileRows) {
    const date = civilPeriod(tx.date);
    const considered = tx.status === 'paid' ? civilPeriod(tx.paymentDate)
      : tx.status !== 'overdue' && date && date >= today.slice(0, date.length) ? date : undefined;
    if (considered) consideredDates.set(tx.id, considered);
    if (!date) continue;
    const month = date.slice(0, 7);
    const entries = registered.get(month) ?? [];
    entries.push(tx);
    registered.set(month, entries);
  }

  const horizonEnd = periodEnd(endMonth);
  const groups = collectPurchaseSeries(profileId, profileRows, today, horizonEnd);
  const { summaries, assumedFlows, invalidSeries } = projectPurchaseSeries({ baseDate: today, horizonEnd, recurrenceAssumptions }, groups, consideredDates, currentMonth + '-01');
  const assumed = new Map<string, { income: bigint; expense: bigint }>();
  for (const flow of assumedFlows) {
    const month = flow.period.slice(0, 7);
    const amounts = assumed.get(month) ?? { income: 0n, expense: 0n };
    amounts[flow.type] += flow.cents;
    assumed.set(month, amounts);
  }

  const marginCents = toCents(input.margin ?? 0);
  const margin = validMoneyCents(marginCents) ? BigInt(marginCents) : 0n;
  const invalidDate = profileRows.some(tx => !civilPeriod(tx.date));
  const rows: MonthlyPurchaseRow[] = [];
  for (let index = 0;; index++) {
    const month = addMonths(start, index).toISOString().slice(0, 7);
    const entries = registered.get(month) ?? [];
    const totals = { income: 0n, expense: 0n };
    const settled = { income: 0n, expense: 0n };
    const missing = invalidSeries.map(name => name + ' sem dados válidos para a série');
    for (const tx of entries) {
      const amount = toCents(tx.amount);
      if (!validMoneyCents(amount)) { missing.push(tx.description + ' com valor inválido'); continue; }
      totals[tx.type] += BigInt(amount);
      if (tx.status === 'paid') settled[tx.type] += BigInt(amount);
    }
    const additions = assumed.get(month) ?? { income: 0n, expense: 0n };
    if (totals.income === 0n && additions.income === 0n) missing.push('sem receitas cadastradas');
    if (totals.expense === 0n && additions.expense === 0n) missing.push('sem despesas existentes cadastradas');
    for (const series of summaries) {
      if (!series.gap || month < series.gap.month) continue;
      if (series.kind === 'installment' || !series.transactions.some(tx => tx.date.slice(0, 7) === month)
        && (!series.assumption || month <= series.lastRegistered.date.slice(0, 7))) missing.push(series.description);
    }
    if (invalidDate) missing.push('lançamento sem vencimento válido');
    const charge = charges.get(month);
    const purchase = charge?.cents ?? 0n;
    const withoutPurchase = totals.income + additions.income - totals.expense - additions.expense;
    const withPurchase = withoutPurchase - purchase;
    rows.push({ month, income: totals.income, expenses: totals.expense, received: settled.income, paid: settled.expense,
      assumedIncome: additions.income, assumedExpenses: additions.expense, purchase, purchaseDate: charge?.date,
      withoutPurchase, withPurchase, belowMargin: margin > 0n && withPurchase < margin, missing });
    if (month === endMonth) break;
  }

  const series = summaries.filter(item => item.kind === 'recurrence' ? item.gap || item.assumption || item.firstHistoricalGap
    : item.openCount || item.incomplete || item.lastRegistered.date.slice(0, 7) >= currentMonth);
  const covered = rows.filter(row => !row.missing.length);
  const comparable = covered.length ? covered : rows;
  return {
    rows, series, firstNegative: comparable.find(row => row.withPurchase < 0n),
    tightest: comparable.reduce((lowest, row) => row.withPurchase < lowest.withPurchase ? row : lowest),
    relief: summaries.flatMap(item => {
      if (item.kind !== 'installment' || item.incomplete) return [];
      const last = civilPeriod(item.lastRegistered.date);
      if (!last || last.slice(0, 7) === '9999-12' || last.slice(0, 7) < currentMonth) return [];
      const lastExpenseMonth = last.slice(0, 7);
      const month = addMonths(parseCalendarDate(lastExpenseMonth + '-01'), 1).toISOString().slice(0, 7);
      const cents = item.transactions.filter(tx => tx.date.slice(0, 7) === lastExpenseMonth)
        .reduce((sum, tx) => validMoneyCents(toCents(tx.amount)) ? sum + BigInt(toCents(tx.amount)) : sum, 0n);
      return cents > 0n ? [{ key: item.key, month, description: item.description, cents }] : [];
    }),
  };
}
