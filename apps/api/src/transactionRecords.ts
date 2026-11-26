import { randomUUID } from 'node:crypto';
import { addMonths, installmentCents, parseCalendarDate, toCents, transactionCount,
  type CreateTransactionInput } from '@organizador/shared';

export function buildTransactionRecords(
  profileId: string,
  item: Omit<CreateTransactionInput, 'profileId' | 'repeatMonths'>,
  repeatMonths: number,
  groupSingleRecurrence: boolean,
) {
  const baseDate = parseCalendarDate(item.date);
  const count = transactionCount(item, repeatMonths);
  const installment = item.category === 'installment';
  const groupedRecurrence = (item.category === 'fixed' || item.category === 'recurring') &&
    (count > 1 || groupSingleRecurrence);
  const groupId = installment || groupedRecurrence ? item.groupId || randomUUID() : item.groupId ?? null;
  const first = item.currentInstallment ?? 1;
  const total = item.totalInstallments ?? 1;
  const purchaseCents = item.amountMode === 'total' ? toCents(item.amount) : null;

  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(baseDate, index);
    const number = first + index;
    const status = index === 0 ? item.status : 'pending';

    return {
      id: randomUUID(),
      profileId,
      type: item.type,
      category: item.category,
      amount: purchaseCents === null ? item.amount : installmentCents(purchaseCents, total, number) / 100,
      description: item.description,
      date,
      currentInstallment: installment ? number : groupedRecurrence ? null : item.currentInstallment ?? null,
      totalInstallments: installment ? total : groupedRecurrence ? null : item.totalInstallments ?? null,
      groupId,
      status,
      paymentDate: status === 'paid' ? (item.paymentDate ? parseCalendarDate(item.paymentDate) : date) : null,
    };
  });
}
