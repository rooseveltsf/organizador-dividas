import { toCents, type Transaction } from '@organizador/shared';

export const COMMITMENT_CATEGORIES = ['fixed', 'recurring', 'installment'] as const;
export type CommitmentCategory = (typeof COMMITMENT_CATEGORIES)[number];

type Commitment = Transaction & { category: CommitmentCategory };
type Remainder = { count: number; cents: bigint };

export function summarizeCommitments(rows: Transaction[], profileId: string, month: string) {
  const openByCategory: Record<CommitmentCategory, bigint> = { fixed: 0n, recurring: 0n, installment: 0n };
  const laterBySeries = new Map<string, Remainder>();
  const commitments: Commitment[] = [];
  let plannedCents = 0n;
  let paidCents = 0n;
  let nextMonth: string | undefined;

  for (const tx of rows) {
    if (tx.profileId !== profileId || tx.type !== 'expense') continue;
    const category = tx.category;
    if (category !== 'fixed' && category !== 'recurring' && category !== 'installment') continue;
    const dueMonth = tx.date.slice(0, 7);
    if (dueMonth < month) continue;

    if (dueMonth === month) {
      const cents = BigInt(toCents(tx.amount));
      commitments.push({ ...tx, category });
      plannedCents += cents;
      if (tx.status === 'paid') paidCents += cents;
      else openByCategory[category] += cents;
    } else {
      if (!nextMonth || dueMonth < nextMonth) nextMonth = dueMonth;
      if (category === 'installment' && tx.groupId && tx.status !== 'paid') {
        const remainder = laterBySeries.get(tx.groupId) ?? { count: 0, cents: 0n };
        remainder.count += 1;
        remainder.cents += BigInt(toCents(tx.amount));
        laterBySeries.set(tx.groupId, remainder);
      }
    }
  }

  commitments.sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10))
    || a.description.localeCompare(b.description, 'pt-BR') || a.id.localeCompare(b.id));

  return { commitments, plannedCents, paidCents, openByCategory, laterBySeries, nextMonth };
}
