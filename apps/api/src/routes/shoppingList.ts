import { Router, type Request, type Response } from 'express';
import type { ShoppingItem as StoredItem } from '@prisma/client';
import { ZodError } from 'zod';
import { shoppingItemSchema, shoppingPurchaseCandidate, shoppingPurchaseOverridesSchema, shoppingPurchaseSchema,
  type ShoppingItem } from '@organizador/shared';
import { prisma } from '../prisma';
import { isMissingRecord, profileAccessFilter, ProfileAccessError, respondProfileError } from '../profileAccess';
import { buildTransactionRecords } from '../transactionRecords';

const router = Router();

function scope(req: Request, profileId: string) {
  return { profileId, profile: profileAccessFilter(req) };
}

function itemScope(req: Request, profileId: string) {
  return { ...scope(req, profileId), id: req.params.itemId };
}

async function findItem(where: ReturnType<typeof itemScope>) {
  const item = await prisma.shoppingItem.findUnique({ where });
  if (!item) throw new ProfileAccessError(404, 'SHOPPING_ITEM_NOT_FOUND', 'Item da lista não encontrado.');
  return item;
}

function present({ revision: _revision, ...item }: StoredItem): ShoppingItem {
  return {
    ...item,
    paymentMethod: item.paymentMethod as ShoppingItem['paymentMethod'],
    actualPaymentMethod: item.actualPaymentMethod as ShoppingItem['actualPaymentMethod'],
    createdAt: item.createdAt.toISOString(),
    purchasedAt: item.purchasedAt?.toISOString() ?? null,
    archivedAt: item.archivedAt?.toISOString() ?? null,
  };
}

function handle(action: (req: Request, res: Response, profileId: string) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await action(req, res, res.locals.profile.id);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, code: 'SHOPPING_VALIDATION', message: error.issues[0].message });
        return;
      }
      respondProfileError(res, error, 'Não foi possível concluir a ação na Lista de compras. Tente novamente.');
    }
  };
}

router.get('/', handle(async (req, res, profileId) => {
  const items = await prisma.shoppingItem.findMany({ where: scope(req, profileId), orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: items.map(present) });
}));

router.post('/', handle(async (req, res, profileId) => {
  const item = await prisma.shoppingItem.create({
    data: {
      ...shoppingItemSchema.parse(req.body),
      profile: { connect: { id: profileId, ...profileAccessFilter(req) } },
    },
  });
  res.status(201).json({ success: true, data: present(item) });
}));

router.get('/:itemId', handle(async (req, res, profileId) => {
  const item = await findItem(itemScope(req, profileId));
  res.json({ success: true, data: present(item) });
}));

router.put('/:itemId', handle(async (req, res, profileId) => {
  const where = itemScope(req, profileId);
  const data = shoppingItemSchema.parse(req.body);
  try {
    const item = await prisma.shoppingItem.update({
      where: { ...where, purchasedAt: null, archivedAt: null },
      data: { ...data, revision: { increment: 1 } },
    });
    res.json({ success: true, data: present(item) });
  } catch (error) {
    if (!isMissingRecord(error)) throw error;
    await findItem(where);
    throw new ProfileAccessError(409, 'SHOPPING_ITEM_CLOSED', 'O item já foi comprado ou arquivado.');
  }
}));

router.post('/:itemId/complete', handle(async (req, res, profileId) => {
  const where = itemScope(req, profileId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const item = await findItem(where);
    if (item.purchasedAt) {
      res.json({ success: true, data: present(item) });
      return;
    }
    if (item.archivedAt) throw new ProfileAccessError(409, 'SHOPPING_ITEM_CLOSED', 'O item está arquivado.');

    const overrides = shoppingPurchaseOverridesSchema.parse(req.body ?? {});
    const purchase = shoppingPurchaseSchema.parse(shoppingPurchaseCandidate(
      { ...item, paymentMethod: item.paymentMethod as ShoppingItem['paymentMethod'] }, overrides,
    ));
    const installment = purchase.paymentMethod === 'installments';
    const records = buildTransactionRecords(profileId, {
      type: 'expense',
      category: installment ? 'installment' : 'daily',
      amount: purchase.amount,
      amountMode: installment ? 'total' : undefined,
      description: item.name,
      date: purchase.date,
      totalInstallments: purchase.installmentCount,
      status: installment ? 'pending' : 'paid',
    }, 1, false);

    try {
      // A atualização condicional vem primeiro. Se outro dispositivo alterou o item,
      // toda a operação falha antes de inserir qualquer lançamento.
      const [bought] = await prisma.$transaction([
        prisma.shoppingItem.update({
          where: { ...where, purchasedAt: null, archivedAt: null, revision: item.revision },
          data: {
            purchasedAt: new Date(),
            actualAmount: purchase.amount,
            actualPaymentMethod: purchase.paymentMethod,
            actualInstallmentCount: purchase.installmentCount,
            actualDate: purchase.date,
            transactionId: installment ? null : records[0].id,
            groupId: records[0].groupId,
          },
        }),
        prisma.transaction.createMany({ data: records }),
      ]);
      res.json({ success: true, data: present(bought) });
      return;
    } catch (error) {
      if (!isMissingRecord(error)) throw error;
    }
  }
  throw new ProfileAccessError(409, 'SHOPPING_ITEM_CHANGED', 'O item foi alterado. Tente novamente.');
}));

router.post('/:itemId/archive', handle(async (req, res, profileId) => {
  const where = itemScope(req, profileId);
  await prisma.shoppingItem.updateMany({ where: { ...where, archivedAt: null }, data: { archivedAt: new Date() } });
  res.json({ success: true, data: present(await findItem(where)) });
}));

router.get('/:itemId/transaction', handle(async (req, res, profileId) => {
  const item = await findItem(itemScope(req, profileId));
  const link = item.groupId ? { groupId: item.groupId } : item.transactionId ? { id: item.transactionId } : null;
  const row = link && await prisma.transaction.findFirst({
    where: { ...scope(req, profileId), ...link },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: { id: true, date: true },
  });
  if (!row) throw new ProfileAccessError(404, 'SHOPPING_TRANSACTION_NOT_FOUND', 'O lançamento vinculado não está disponível no Extrato deste perfil.');
  res.json({ success: true, data: row });
}));

export default router;
