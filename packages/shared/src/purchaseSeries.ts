import { addMonths, civilPeriod, parseCalendarDate, periodEnd } from './calendar';
import { toCents, validMoneyCents } from './money';
import type { PurchaseFlow, PurchaseSimulationInput, PurchaseTransaction } from './purchaseSimulation';

export type RecurrenceAssumption = { mode: 'continue' } | { mode: 'end'; date: string };

export interface PurchaseSeries {
  key: string;
  groupId?: string;
  kind: 'installment' | 'recurrence';
  type: PurchaseTransaction['type'];
  transactions: PurchaseTransaction[];
}

interface SeriesSummary extends PurchaseSeries {
  description: string;
  consideredDates: ReadonlyMap<string, string>;
  lastRegistered: PurchaseTransaction;
  gap?: { month: string; reason: 'installments' | 'missing_month' | 'projection_end' };
}

export type PurchaseSeriesSummary = SeriesSummary & (
  | {
    kind: 'installment';
    lastIdentified?: PurchaseTransaction;
    missing: { first: number; last: number }[];
    incomplete: boolean;
    openCount: number;
    end?: { period: string; cents: bigint; settled: boolean };
  }
  | { kind: 'recurrence'; assumption?: RecurrenceAssumption; firstHistoricalGap?: string }
);

function due(tx: PurchaseTransaction) {
  return civilPeriod(tx.date) ?? '';
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDue(a: PurchaseTransaction, b: PurchaseTransaction) {
  return compareText(due(a), due(b)) || (a.currentInstallment ?? 0) - (b.currentInstallment ?? 0) || compareText(a.id, b.id);
}

export function collectPurchaseSeries(profileId: string, transactions: readonly PurchaseTransaction[], baseDate: string, horizonEnd: string) {
  const groups = new Map<string, PurchaseSeries>();
  for (const tx of transactions) {
    if (tx.profileId !== profileId) continue;
    const installment = tx.category === 'installment' && tx.type === 'expense';
    const recurrence = tx.category === 'fixed' || tx.category === 'recurring';
    if (!installment && !recurrence) continue;
    if (!tx.groupId && installment && tx.currentInstallment == null && tx.totalInstallments == null) continue;
    if (!tx.groupId && recurrence && tx.status === 'paid' && due(tx).slice(0, 7) < baseDate.slice(0, 7)) continue;
    const kind = installment ? 'installment' : 'recurrence';
    const groupId = tx.groupId || undefined;
    const key = JSON.stringify([kind, tx.type, groupId ? 'group' : 'row', groupId ?? tx.id]);
    const group = groups.get(key);
    if (group) group.transactions.push(tx);
    else groups.set(key, { key, groupId, kind, type: tx.type, transactions: [tx] });
  }
  return [...groups.values()].filter(group => group.transactions.some(tx => {
    const payment = tx.status === 'paid' ? civilPeriod(tx.paymentDate) : undefined;
    return due(tx) <= horizonEnd || (payment && payment <= horizonEnd)
      || (tx.status === 'overdue' && tx.type === 'expense');
  }))
    .map(group => ({ ...group, transactions: group.transactions.sort(compareDue) }))
    .sort((a, b) => compareDue(a.transactions[a.transactions.length - 1], b.transactions[b.transactions.length - 1]) || compareText(a.key, b.key));
}

function nextMonth(month: string) {
  return month === '9999-12' ? undefined : addMonths(parseCalendarDate(month + '-01'), 1).toISOString().slice(0, 7);
}

function summarizeInstallments(summary: SeriesSummary, baseDate: string): PurchaseSeriesSummary {
  const { transactions, consideredDates } = summary;
  const numbered = new Map<number, PurchaseTransaction>();
  const total = transactions[0].totalInstallments;
  const reliableTotal = total != null && Number.isSafeInteger(total) && total > 0
    && transactions.every(tx => tx.totalInstallments === total);
  let invalidNumbering = !reliableTotal;
  for (const tx of transactions) {
    const number = tx.currentInstallment;
    if (number == null || !Number.isSafeInteger(number) || number < 1 || (reliableTotal && number > total) || numbered.has(number) || !due(tx)) {
      invalidNumbering = true;
      continue;
    }
    numbered.set(number, tx);
  }

  const missing: { first: number; last: number }[] = [];
  let gapMonth = invalidNumbering ? baseDate.slice(0, 7) : undefined;
  let previousNumber = 0;
  if (reliableTotal) {
    // Missing numbers delimit coverage using their neighbors. Only recorded dates become cash movements.
    const numbers = [...numbered.keys()].sort((a, b) => a - b);
    for (const number of numbers) {
      if (number > previousNumber + 1) {
        missing.push({ first: previousNumber + 1, last: number - 1 });
        const prior = numbered.get(previousNumber);
        const followingMonth = due(numbered.get(number)!).slice(0, 7);
        const monthAfterPrior = prior && nextMonth(due(prior).slice(0, 7));
        const gap = prior ? (monthAfterPrior && monthAfterPrior < followingMonth ? monthAfterPrior : followingMonth) : baseDate.slice(0, 7);
        if (!gapMonth || gap < gapMonth) gapMonth = gap;
      }
      previousNumber = number;
    }
    if (previousNumber < total) {
      missing.push({ first: previousNumber + 1, last: total });
      const prior = numbered.get(previousNumber);
      const gap = prior ? nextMonth(due(prior).slice(0, 7)) : baseDate.slice(0, 7);
      if (gap && (!gapMonth || gap < gapMonth)) gapMonth = gap;
    }
  }

  const openCount = transactions.filter(tx => tx.status !== 'paid').length;
  const incomplete = invalidNumbering || missing.length > 0;
  const finalRows = reliableTotal ? transactions.filter(tx => tx.currentInstallment === total) : [];
  const lastIdentified = finalRows.length === 1 && due(finalRows[0]) ? finalRows[0] : undefined;
  let period: string | undefined;
  let cents = 0n;
  if (!incomplete) {
    for (const tx of transactions) {
      const considered = consideredDates.get(tx.id);
      const amount = toCents(tx.amount);
      if (!considered || !validMoneyCents(amount)) {
        period = undefined;
        break;
      }
      if (!period || periodEnd(considered) > periodEnd(period)) {
        period = considered;
        cents = BigInt(amount);
      } else if (periodEnd(considered) === periodEnd(period)) {
        if (considered.length < period.length) period = considered;
        cents += BigInt(amount);
      }
    }
  }

  return { ...summary, kind: 'installment', lastIdentified, missing, incomplete, openCount,
    gap: gapMonth ? { month: gapMonth, reason: 'installments' } : undefined,
    end: period ? { period, cents, settled: openCount === 0 && periodEnd(period) <= baseDate } : undefined };
}

export function projectPurchaseSeries(input: Pick<PurchaseSimulationInput, 'baseDate' | 'horizonEnd' | 'recurrenceAssumptions' | 'adjustments'>,
  groups: PurchaseSeries[], effectivePeriods: ReadonlyMap<string, string>, projectionStart = input.baseDate) {
  const { baseDate, horizonEnd, recurrenceAssumptions, adjustments } = input;
  const baseMonth = baseDate.slice(0, 7);
  const horizonMonth = horizonEnd.slice(0, 7);
  const summaries: PurchaseSeriesSummary[] = [];
  const assumedFlows: PurchaseFlow[] = [];
  const invalidSeries: string[] = [];
  let coveredThrough: string | undefined;
  for (const group of groups) {
    const { transactions, key, kind, type } = group;
    const lastRegistered = transactions[transactions.length - 1];
    const description = lastRegistered.description;
    const consideredDates = new Map<string, string>();
    for (const tx of transactions) {
      const date = effectivePeriods.get(tx.id);
      if (date) consideredDates.set(tx.id, date);
    }
    const summary = { ...group, lastRegistered, description, consideredDates };
    if (kind === 'installment') {
      summaries.push(summarizeInstallments(summary, baseDate));
      continue;
    }

    const anchor = due(lastRegistered);
    const assumption = recurrenceAssumptions?.get(key);
    if (!anchor || (assumption?.mode === 'end' && (assumption.date.length !== 10
      || civilPeriod(assumption.date) !== assumption.date || assumption.date < periodEnd(anchor)))) {
      invalidSeries.push(description);
      continue;
    }
    const lastMonth = anchor.slice(0, 7);
    const months = [...new Set(transactions.map(tx => due(tx).slice(0, 7)).filter(Boolean))];
    let gap: SeriesSummary['gap'];
    let firstHistoricalGap: string | undefined;
    for (let index = 1; index < months.length; index++) {
      const firstMissing = nextMonth(months[index - 1]);
      if (!firstMissing || firstMissing >= months[index]) continue;
      if (firstMissing < baseMonth) firstHistoricalGap ??= firstMissing;
      const month = firstMissing < baseMonth ? baseMonth : firstMissing;
      if (month < months[index] && month <= horizonMonth) {
        gap = { month, reason: 'missing_month' };
        break;
      }
    }
    const next = nextMonth(lastMonth);
    if (!gap && !assumption && next && next <= horizonMonth) gap = { month: next, reason: 'projection_end' };
    summaries.push({ ...summary, kind: 'recurrence', gap, assumption, firstHistoricalGap });

    const through = assumption ? horizonEnd : periodEnd(lastMonth);
    if (through >= baseDate && (!coveredThrough || through > coveredThrough)) coveredThrough = through;
    if (!assumption || !next) continue;

    const cents = toCents(lastRegistered.amount);
    if (!validMoneyCents(cents)) {
      invalidSeries.push(description);
      continue;
    }
    const monthly = anchor.length === 7;
    const anchorDate = parseCalendarDate(monthly ? anchor + '-01' : anchor);
    const selection = type === 'income' && lastRegistered.status !== 'paid' ? adjustments?.get(lastRegistered.id)?.income : undefined;
    if (selection === 'excluded') continue;
    // Assumed occurrences start at the opening balance. The history keeps only recorded movements.
    for (let month = next < baseMonth ? baseMonth : next; month <= horizonMonth;) {
      const offset = (Number(month.slice(0, 4)) - Number(lastMonth.slice(0, 4))) * 12 + Number(month.slice(5)) - Number(lastMonth.slice(5));
      const period = monthly ? month : addMonths(anchorDate, offset).toISOString().slice(0, 10);
      if (period > horizonEnd.slice(0, period.length) || (assumption.mode === 'end' && periodEnd(period) > assumption.date)) break;
      if (period >= projectionStart.slice(0, period.length)) {
        assumedFlows.push({ id: 'recurrence:' + key + ':' + period, period, description, type, cents: BigInt(cents),
          timing: 'assumed_recurrence', income: type === 'income' ? selection ?? 'uncertain' : undefined });
      }
      if (month === horizonMonth) break;
      month = nextMonth(month)!;
    }
  }
  return { summaries, assumedFlows, coveredThrough, invalidSeries };
}
