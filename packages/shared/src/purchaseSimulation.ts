import { addMonths, civilPeriod, periodEnd, shiftCivilDay, parseCalendarDate } from './calendar';
import { toCents, validMoneyCents } from './money';
import type { Transaction } from './index';
import { collectPurchaseSeries, projectPurchaseSeries, type PurchaseSeriesSummary, type RecurrenceAssumption } from './purchaseSeries';

export type IncomeAssumption = 'expected' | 'uncertain' | 'excluded';
export type PurchaseTransaction = Pick<Transaction,
  'id' | 'profileId' | 'description' | 'type' | 'amount' | 'date' | 'status' | 'paymentDate'
  | 'groupId' | 'currentInstallment' | 'totalInstallments'> & Partial<Pick<Transaction, 'category'>>;

export interface PurchaseSimulationInput {
  profileId: string;
  baseDate: string;
  horizonEnd: string;
  price?: number;
  openingBalance?: number;
  reserve?: number;
  additionalMonthlyExpenses?: number;
  confirmedCoverageEnd?: string;
  adjustments?: ReadonlyMap<string, { date?: string; income?: IncomeAssumption }>;
  recurrenceAssumptions?: ReadonlyMap<string, RecurrenceAssumption>;
}

export interface PurchaseFlow {
  id?: string;
  description: string;
  period: string;
  type: 'income' | 'expense';
  cents: bigint;
  timing: 'scheduled' | 'settled' | 'immediate' | 'rescheduled' | 'estimate' | 'assumed_recurrence';
  income?: 'expected' | 'uncertain';
}

interface BalancePoint {
  period: string;
  cents: bigint;
  firstFlowIndex: number;
  afterExpensesIndex: number;
}

export type PurchaseOutcome =
  | { status: 'fits'; purchase: BalancePoint; minimum: BalancePoint }
  | { status: 'blocked'; deficit: BalancePoint }
  | { status: 'does_not_fit'; bestMinimum: BalancePoint }
  | { status: 'insufficient_data'; bestMinimum?: BalancePoint };

export interface PurchaseScenario {
  outcome: PurchaseOutcome;
  flows: PurchaseFlow[];
}

type RequiredInput = 'profileId' | 'baseDate' | 'horizonEnd' | 'price' | 'openingBalance' | 'reserve'
  | 'additionalMonthlyExpenses' | 'confirmedCoverageEnd';

export type PurchaseSimulation =
  | { status: 'insufficient_data'; invalidFields: RequiredInput[]; invalidTransactions: string[]; invalidSeries?: string[] }
  | {
    status: 'calculated';
    precision: 'day' | 'month';
    coverage: { requestedThrough: string; recordsThrough?: string; confirmedThrough?: string; analyzedThrough?: string; firstSeriesGap?: string };
    series: PurchaseSeriesSummary[];
    omittedIncome: { id: string; description: string; reason: 'late' | 'excluded' }[];
    planned: PurchaseScenario;
    conservative: PurchaseScenario;
  };

function nextPeriod(period: string) {
  if (period.length === 7) return addMonths(parseCalendarDate(period + '-01'), 1).toISOString().slice(0, 7);
  return shiftCivilDay(period, 1);
}

function validAmount(amount: number | undefined, signed = false, zero = false) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || (!signed && amount < 0)) return false;
  const cents = Math.abs(toCents(amount));
  return (zero && cents === 0) || validMoneyCents(cents);
}

export function simulatePurchase(input: PurchaseSimulationInput, transactions: readonly PurchaseTransaction[]): PurchaseSimulation {
  const { profileId, baseDate, horizonEnd, price, openingBalance, reserve, confirmedCoverageEnd,
    additionalMonthlyExpenses = 0, adjustments } = input;
  const invalidFields: RequiredInput[] = [];
  if (!profileId) invalidFields.push('profileId');
  if (baseDate?.length !== 10 || civilPeriod(baseDate) !== baseDate) invalidFields.push('baseDate');
  if (horizonEnd?.length !== 10 || civilPeriod(horizonEnd) !== horizonEnd || horizonEnd < baseDate) invalidFields.push('horizonEnd');
  if (!validAmount(price)) invalidFields.push('price');
  if (!validAmount(openingBalance, true, true)) invalidFields.push('openingBalance');
  if (!validAmount(reserve, false, true)) invalidFields.push('reserve');
  if (!validAmount(additionalMonthlyExpenses, false, true)) invalidFields.push('additionalMonthlyExpenses');
  if (confirmedCoverageEnd !== undefined && (confirmedCoverageEnd?.length !== 10
      || civilPeriod(confirmedCoverageEnd) !== confirmedCoverageEnd || confirmedCoverageEnd < baseDate)) {
    invalidFields.push('confirmedCoverageEnd');
  }
  const invalidTransactions: string[] = [];
  if (invalidFields.length || price === undefined || openingBalance === undefined || reserve === undefined) {
    return { status: 'insufficient_data', invalidFields, invalidTransactions };
  }

  const flows: PurchaseFlow[] = [];
  const effectivePeriods = new Map<string, string>();
  const omittedIncome: Extract<PurchaseSimulation, { status: 'calculated' }>['omittedIncome'] = [];
  let recordsThrough: string | undefined;
  for (const tx of transactions) {
    if (tx.profileId !== profileId) continue;
    const paid = tx.status === 'paid';
    const adjustment = paid ? undefined : adjustments?.get(tx.id);
    const income = tx.type === 'income' && !paid ? adjustment?.income ?? 'uncertain' : undefined;
    if (income === 'excluded') {
      omittedIncome.push({ id: tx.id, description: tx.description, reason: 'excluded' });
      continue;
    }

    // A legacy paid row without a settlement date is treated as already reflected in opening cash.
    if (paid && !tx.paymentDate) continue;
    const original = civilPeriod(paid ? tx.paymentDate : tx.date);
    const moved = adjustment?.date !== undefined ? civilPeriod(adjustment.date) : undefined;
    if (!original || (adjustment?.date !== undefined && (!moved || moved < baseDate.slice(0, moved.length)))) {
      invalidTransactions.push(tx.description);
      continue;
    }
    if (paid && original <= baseDate) {
      effectivePeriods.set(tx.id, original);
      continue;
    }
    const overdue = !paid && (tx.status === 'overdue' || original < baseDate.slice(0, original.length));
    if (overdue && !moved && tx.type === 'income') {
      omittedIncome.push({ id: tx.id, description: tx.description, reason: 'late' });
      continue;
    }
    const immediate = overdue && !moved;
    const period = moved ?? (immediate ? baseDate : original);
    effectivePeriods.set(tx.id, period);
    if (!immediate) {
      const through = periodEnd(period);
      if (!recordsThrough || through > recordsThrough) recordsThrough = through;
    }
    if (period > horizonEnd.slice(0, period.length)) continue;
    if (!validAmount(tx.amount)) {
      invalidTransactions.push(tx.description);
      continue;
    }
    flows.push({
      id: tx.id, description: tx.description, period, cents: BigInt(toCents(tx.amount)), type: tx.type, income,
      timing: paid ? 'settled' : moved ? 'rescheduled' : immediate ? 'immediate' : 'scheduled',
    });
  }
  if (invalidTransactions.length) return { status: 'insufficient_data', invalidFields, invalidTransactions };

  const groups = collectPurchaseSeries(profileId, transactions, baseDate, horizonEnd);
  const { summaries, assumedFlows, coveredThrough, invalidSeries } = projectPurchaseSeries(input, groups, effectivePeriods);
  if (invalidSeries.length) return { status: 'insufficient_data', invalidFields, invalidTransactions, invalidSeries };
  for (const flow of assumedFlows) flows.push(flow);
  let firstSeriesGap: string | undefined;
  for (const { gap } of summaries) {
    const date = gap && gap.month + '-01';
    if (date && date <= horizonEnd && (!firstSeriesGap || date < firstSeriesGap)) firstSeriesGap = date;
  }
  const coverageEnd = [recordsThrough, confirmedCoverageEnd, coveredThrough].reduce<string | undefined>(
    (latest, date) => date && (!latest || date > latest) ? date : latest, undefined);
  let analyzedThrough = coverageEnd && (coverageEnd < horizonEnd ? coverageEnd : horizonEnd);
  if (firstSeriesGap && analyzedThrough && firstSeriesGap <= analyzedThrough) {
    analyzedThrough = firstSeriesGap <= baseDate ? undefined : shiftCivilDay(firstSeriesGap, -1);
  }
  const monthly = flows.some(flow => flow.period.length === 7 && analyzedThrough && flow.period <= analyzedThrough.slice(0, 7));
  if (monthly && analyzedThrough && periodEnd(analyzedThrough.slice(0, 7)) !== analyzedThrough) {
    const previousDay = shiftCivilDay(analyzedThrough.slice(0, 7) + '-01', -1);
    analyzedThrough = previousDay >= baseDate ? previousDay : undefined;
  }

  const length = monthly ? 7 : 10;
  const first = baseDate.slice(0, length);
  const last = analyzedThrough?.slice(0, length);
  const additionalCents = BigInt(toCents(additionalMonthlyExpenses));
  const coveredFlows = flows.filter(flow => flow.period.slice(0, length) <= (last ?? first)
    // An uncovered period cannot establish a deficit based on a month-only budget.
    && (last !== undefined || flow.period === baseDate));
  if (last && additionalCents > 0n) {
    for (let period = first; period <= last;) {
      coveredFlows.push({ period, description: 'Estimativa de despesas variáveis extras', cents: additionalCents,
        type: 'expense', timing: 'estimate' });
      const month = period.slice(0, 7);
      if (month === last.slice(0, 7)) break;
      const next = nextPeriod(month);
      period = monthly ? next : next + '-01';
    }
  }
  const projected = coveredFlows.map(flow => ({ ...flow, period: flow.period.slice(0, length) }));
  projected.sort((a, b) => compareText(a.period, b.period) || compareText(a.type, b.type) || compareText(a.id ?? '', b.id ?? ''));

  const complete = analyzedThrough === horizonEnd;
  const opening = BigInt(toCents(openingBalance));
  const purchase = BigInt(toCents(price));
  const minimum = BigInt(toCents(reserve));
  return {
    status: 'calculated', precision: monthly ? 'month' : 'day',
    coverage: { requestedThrough: horizonEnd, recordsThrough, confirmedThrough: confirmedCoverageEnd, analyzedThrough, firstSeriesGap },
    series: summaries,
    omittedIncome,
    planned: evaluateScenario(projected, first, last, complete, opening, purchase, minimum, firstSeriesGap),
    conservative: evaluateScenario(projected.filter(flow => flow.income !== 'uncertain'), first, last, complete,
      opening, purchase, minimum, firstSeriesGap),
  };
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function evaluateScenario(flows: PurchaseFlow[], first: string, last: string | undefined, complete: boolean,
  opening: bigint, price: bigint, reserve: bigint, firstSeriesGap?: string): PurchaseScenario {
  let balance = opening;
  let flowIndex = 0;
  const points: BalancePoint[] = [];
  if (balance < 0n) {
    return { flows, outcome: { status: 'blocked', deficit: { period: first, cents: balance, firstFlowIndex: 0, afterExpensesIndex: 0 } } };
  }
  // Between movements the balance is constant. Only the first period and the first period after credits add candidates.
  for (let period: string | undefined = first; period !== undefined;) {
    const firstFlowIndex = flowIndex;
    while (flows[flowIndex]?.period === period && flows[flowIndex].type === 'expense') {
      balance -= flows[flowIndex++].cents;
    }
    const point: BalancePoint = { period, cents: balance, firstFlowIndex, afterExpensesIndex: flowIndex };
    if (balance < 0n) return { flows, outcome: { status: 'blocked', deficit: point } };
    points.push(point);

    while (flows[flowIndex]?.period === period) balance += flows[flowIndex++].cents;
    const afterCredit: string | undefined = flowIndex > point.afterExpensesIndex && last && period < last
      ? nextPeriod(period) : undefined;
    const nextMovement: string | undefined = flows[flowIndex]?.period;
    period = afterCredit && (!nextMovement || afterCredit < nextMovement) ? afterCredit : nextMovement;
  }
  if (!last || firstSeriesGap) return { flows, outcome: { status: 'insufficient_data' } };

  let lowest = points[points.length - 1];
  const afterPurchase = (point: BalancePoint) => ({ ...point, cents: point.cents - price });
  const bestMinimum = afterPurchase(lowest);
  let fits: Extract<PurchaseOutcome, { status: 'fits' }> | undefined;
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index];
    if (point.cents <= lowest.cents) lowest = point;
    if (lowest.cents - price >= reserve) fits = { status: 'fits', purchase: point, minimum: afterPurchase(lowest) };
  }
  return { flows, outcome: fits ?? { status: complete ? 'does_not_fit' : 'insufficient_data', bestMinimum } };
}
