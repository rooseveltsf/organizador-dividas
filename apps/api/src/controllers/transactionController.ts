import { Request, Response } from 'express';
import { buildTransactionRecords } from '../transactionRecords';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { profileAccessFilter, ProfileAccessError, requireProfileAccess, respondProfileError } from '../profileAccess';
import {
  ApiResponse,
  PaymentStatus,
  TransactionType,
  TransactionCategory,
  calendarDateSchema,
  calendarDay,
  calendarMonthRange,
  parseCalendarDate,
  transactionCount,
  createTransactionSchema,
  updateTransactionSchema,
  updateStatusSchema,
  batchCreateTransactionSchema,
} from '@organizador/shared';

export { addMonths, parseCalendarDate as parseLocalDate } from '@organizador/shared';

export class TransactionController {
  /**
   * 1. GET /transactions
   * Retorna as transações exigindo obrigatoriamente "profileId" e aplicando filtros por data/mês.
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { profileId, month, year, startDate, endDate, type, category, status, groupId, search } = req.query;

      // Validação estrita: profileId é obrigatório
      if (!profileId || typeof profileId !== 'string' || !profileId.trim()) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'O parâmetro de consulta "profileId" é obrigatório para listar transações.',
        };
        res.status(400).json(badRequest);
        return;
      }

      const cleanProfileId = profileId.trim();

      await requireProfileAccess(req, cleanProfileId);

      let dateFilter: { gte?: Date; lte?: Date } | undefined;

      if (month !== undefined || year !== undefined) {
        if (typeof month !== 'string' || !/^(?:0?[1-9]|1[0-2])$/.test(month) ||
            typeof year !== 'string' || !/^\d{4}$/.test(year)) {
          res.status(400).json({
            success: false,
            message: 'Informe month de 1 a 12 e year com quatro dígitos.',
          });
          return;
        }

        dateFilter = calendarMonthRange(year + '-' + month.padStart(2, '0'));
      }

      if (startDate !== undefined) {
        const parsed = calendarDateSchema.safeParse(startDate);
        if (!parsed.success) {
          res.status(400).json({ success: false, message: 'startDate inválido. Use o formato YYYY-MM-DD.' });
          return;
        }
        const start = parseCalendarDate(parsed.data);
        start.setUTCHours(0, 0, 0, 0);
        dateFilter = { ...dateFilter, gte: start };
      }
      if (endDate !== undefined) {
        const parsed = calendarDateSchema.safeParse(endDate);
        if (!parsed.success) {
          res.status(400).json({ success: false, message: 'endDate inválido. Use o formato YYYY-MM-DD.' });
          return;
        }
        const end = parseCalendarDate(parsed.data);
        end.setUTCHours(23, 59, 59, 999);
        dateFilter = { ...dateFilter, lte: end };
      }
      if (dateFilter?.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
        res.status(400).json({ success: false, message: 'A data inicial deve ser anterior ou igual à data final.' });
        return;
      }

      // Montagem da query isolada por profileId
      const where: {
        profileId: string;
        date?: { gte?: Date; lte?: Date };
        type?: TransactionType;
        category?: TransactionCategory;
        status?: PaymentStatus;
        groupId?: string;
        description?: { contains: string };
      } = {
        profileId: cleanProfileId,
      };

      if (dateFilter) where.date = dateFilter;
      if (type) where.type = type as TransactionType;
      if (category) where.category = category as TransactionCategory;
      if (status) where.status = status as PaymentStatus;
      if (groupId) where.groupId = groupId as string;
      if (search) where.description = { contains: search as string };

      const transactions = await prisma.transaction.findMany({
        where: { ...where, profile: profileAccessFilter(req) },
        orderBy: { date: 'asc' },
      });

      const response: ApiResponse<typeof transactions> = {
        success: true,
        data: transactions,
      };
      res.json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao buscar transações.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 2. POST /transactions
   * Cria transação vinculada ao profileId obrigatório com suporte a:
   * - 'installment': Gera parcelas para os meses subsequentes vinculadas por groupId e profileId.
   * - 'fixed' ou 'recurring': Projeta registros para repeatMonths vinculados por groupId e profileId.
   * - 'daily': Gera registro individual para o perfil.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      // Validação Zod do body (exige profileId)
      const parseResult = createTransactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para criação da transação.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const payload = parseResult.data;

      const items = buildTransactionRecords(payload.profileId, payload, payload.repeatMonths, true);
      if (payload.category !== 'daily') {
        await prisma.$transaction(async db => {
          await requireProfileAccess(req, payload.profileId, db);
          await db.transaction.createMany({ data: items });
        });
        const message = payload.category === 'installment'
          ? `${items.length} parcelas geradas com sucesso para o perfil.`
          : `${items.length} transações (${payload.category}) geradas com sucesso para o perfil.`;
        const response: ApiResponse<{ groupId: string | null; count: number; items: typeof items }> = {
          success: true,
          message,
          data: { groupId: items[0].groupId, count: items.length, items },
        };
        res.status(201).json(response);
        return;
      }

      const singleTransaction = await prisma.$transaction(async db => {
        await requireProfileAccess(req, payload.profileId, db);
        return db.transaction.create({ data: items[0] });
      });
      const response: ApiResponse<typeof singleTransaction> = {
        success: true,
        message: 'Transação criada com sucesso.',
        data: singleTransaction,
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao processar transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(400).json(response);
    }
  }

  /**
   * 3. POST /transactions/batch
   * Criação em lote de múltiplas receitas e despesas vinculadas a um perfil (ex: importação de contracheque),
   * executada atomicamente via prisma.$transaction e projetando meses futuros caso repeatMonths seja informado.
   */
  public static async batchCreate(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = batchCreateTransactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para criação em lote de transações.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const payload = parseResult.data;

      const recordsToCreate = payload.transactions.flatMap(item =>
        buildTransactionRecords(payload.profileId, item, payload.repeatMonths ?? item.repeatMonths ?? 1, false)
      );

      await prisma.$transaction(async db => {
        await requireProfileAccess(req, payload.profileId, db);
        await db.transaction.createMany({ data: recordsToCreate });
      });

      const response: ApiResponse<{ totalCreated: number; profileId: string; items: typeof recordsToCreate }> = {
        success: true,
        message: `${recordsToCreate.length} transações criadas em lote com sucesso para o perfil.`,
        data: {
          totalCreated: recordsToCreate.length,
          profileId: payload.profileId,
          items: recordsToCreate,
        },
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao processar criação em lote de transações.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 4. PUT /transactions/:id
   * Atualiza os dados de uma transação existente com validação Zod (UpdateTransactionDTO).
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await prisma.transaction.findUnique({
        where: { id },
      });

      if (!existing) {
        const notFound: ApiResponse = {
          success: false,
          message: 'Transação não encontrada.',
        };
        res.status(404).json(notFound);
        return;
      }

      await requireProfileAccess(req, existing.profileId);
      const parseResult = updateTransactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para atualização da transação.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const payload = parseResult.data;

      if (payload.profileId && payload.profileId !== existing.profileId) {
        await requireProfileAccess(req, payload.profileId);
      }

      const category = payload.category ?? existing.category;
      if (category === 'installment' && (
        payload.currentInstallment !== undefined || payload.totalInstallments !== undefined ||
        category !== existing.category
      )) {
        const current = payload.currentInstallment === undefined ? existing.currentInstallment : payload.currentInstallment;
        const total = payload.totalInstallments === undefined ? existing.totalInstallments : payload.totalInstallments;
        if (transactionCount({ category, currentInstallment: current, totalInstallments: total }, 1) < 1) {
          res.status(400).json({
            success: false,
            message: 'A parcela atual deve estar entre 1 e o total de parcelas.',
          });
          return;
        }
      }

      const updateData: {
        profile?: Prisma.TransactionUpdateInput['profile'];
        description?: string;
        amount?: number;
        date?: Date;
        category?: string;
        type?: string;
        status?: string;
        paymentDate?: Date | null;
        currentInstallment?: number | null;
        totalInstallments?: number | null;
        groupId?: string | null;
      } = {};

      if (payload.profileId && payload.profileId !== existing.profileId) {
        updateData.profile = { connect: { id: payload.profileId, ...profileAccessFilter(req) } };
      }
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.amount !== undefined) updateData.amount = payload.amount;
      if (payload.category !== undefined) updateData.category = payload.category;
      if (payload.type !== undefined) updateData.type = payload.type;
      if (payload.currentInstallment !== undefined) updateData.currentInstallment = payload.currentInstallment;
      if (payload.totalInstallments !== undefined) updateData.totalInstallments = payload.totalInstallments;
      if (payload.groupId !== undefined) updateData.groupId = payload.groupId;

      if (payload.date !== undefined) updateData.date = parseCalendarDate(payload.date);

      if (payload.status !== undefined) {
        updateData.status = payload.status;
        updateData.paymentDate = payload.status === 'paid'
          ? (payload.paymentDate
            ? parseCalendarDate(payload.paymentDate)
            : existing.paymentDate ?? parseCalendarDate(calendarDay(new Date())))
          : null;
      } else if (payload.paymentDate !== undefined) {
        updateData.paymentDate = payload.paymentDate ? parseCalendarDate(payload.paymentDate) : null;
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id, profileId: existing.profileId, profile: profileAccessFilter(req) },
        data: updateData,
      });

      const response: ApiResponse<typeof updatedTransaction> = {
        success: true,
        message: 'Transação atualizada com sucesso.',
        data: updatedTransaction,
      };
      res.json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao atualizar transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 5. PATCH /transactions/:id/status
   * Alterna o status entre 'pending' e 'paid' (ou define status especificado),
   * preenchendo automaticamente paymentDate quando 'paid' e limpando quando 'pending'.
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await prisma.transaction.findUnique({
        where: { id },
      });

      if (!existing) {
        const notFound: ApiResponse = {
          success: false,
          message: 'Transação não encontrada.',
        };
        res.status(404).json(notFound);
        return;
      }

      await requireProfileAccess(req, existing.profileId);
      // Validação opcional caso payload venha no corpo da requisição
      const parseResult = updateStatusSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Dados inválidos para atualização de status.',
          errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
        res.status(400).json(badRequest);
        return;
      }

      const { status: requestedStatus, paymentDate: requestedPaymentDate } = parseResult.data;

      // Se status explícito não foi enviado, alterna entre 'pending' e 'paid'
      const newStatus: PaymentStatus = requestedStatus ?? (existing.status === 'paid' ? 'pending' : 'paid');

      const newPaymentDate = newStatus === 'paid'
        ? (requestedPaymentDate
          ? parseCalendarDate(requestedPaymentDate)
          : (existing.status === 'paid' ? existing.paymentDate : null) ?? parseCalendarDate(calendarDay(new Date())))
        : null;

      const updatedTransaction = await prisma.transaction.update({
        where: { id, profileId: existing.profileId, profile: profileAccessFilter(req) },
        data: {
          status: newStatus,
          paymentDate: newPaymentDate,
        },
      });

      const response: ApiResponse<typeof updatedTransaction> = {
        success: true,
        message: `Status atualizado para '${newStatus}' com sucesso.`,
        data: updatedTransaction,
      };
      res.json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao atualizar status da transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 6. DELETE /transactions/:id
   * Exclui transação individual ou todas as parcelas/recorrências futuras se ?deleteAll=true e groupId existir.
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleteAll = req.query.deleteAll === 'true';

      const targetTransaction = await prisma.transaction.findUnique({
        where: { id },
      });

      if (!targetTransaction) {
        const notFound: ApiResponse = {
          success: false,
          message: 'Transação não encontrada.',
        };
        res.status(404).json(notFound);
        return;
      }

      await requireProfileAccess(req, targetTransaction.profileId);
      // Se deleteAll for true e possuir um groupId, apaga todas as parcelas/recorrências futuras
      if (deleteAll && targetTransaction.groupId) {
        const from = new Date(targetTransaction.date);
        from.setUTCHours(0, 0, 0, 0);
        const deleteResult = await prisma.transaction.deleteMany({
          where: {
            profileId: targetTransaction.profileId,
            profile: profileAccessFilter(req),
            groupId: targetTransaction.groupId,
            ...(targetTransaction.currentInstallment !== null
              ? { currentInstallment: { gte: targetTransaction.currentInstallment } }
              : { date: { gte: from } }),
          },
        });

        const response: ApiResponse<{ deletedCount: number; groupId: string }> = {
          success: true,
          message: `${deleteResult.count} registro(s) futuro(s) removido(s) com sucesso.`,
          data: {
            deletedCount: deleteResult.count,
            groupId: targetTransaction.groupId,
          },
        };
        res.json(response);
        return;
      }

      // Exclusão individual padrão
      await prisma.transaction.delete({
        where: { id, profileId: targetTransaction.profileId, profile: profileAccessFilter(req) },
      });

      const response: ApiResponse<typeof targetTransaction> = {
        success: true,
        message: 'Transação removida com sucesso.',
        data: targetTransaction,
      };
      res.json(response);
    } catch (error) {
      if (error instanceof ProfileAccessError) return respondProfileError(res, error, '');
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao excluir transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }
}
