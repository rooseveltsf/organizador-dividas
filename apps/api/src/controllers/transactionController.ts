import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma';
import {
  ApiResponse,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  PaymentStatus,
  TransactionType,
  TransactionCategory,
  createTransactionSchema,
  updateTransactionSchema,
  updateStatusSchema,
} from '@organizador/shared';

/**
 * 1. Helper de Correção de Fuso Horário (Timezone Bug):
 * Interpreta strings no formato YYYY-MM-DD extraindo [year, month, day]
 * e instanciando um objeto Date fixado no meio-dia local (12:00:00.000).
 * Isso impede que fusos a oeste de Greenwich (como GMT-3 / Horário de Brasília)
 * desloquem a data para o dia anterior (ex: 21:00 do dia 30/31) ao converter UTC,
 * garantindo integridade visual e consistência nos filtros de listagem.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Data não fornecida ou inválida.');
  }

  // Remove fração de hora ISO caso venha anexada (ex: 2026-10-01T00:00:00.000Z -> 2026-10-01)
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = cleanDate.split('-');

  if (parts.length < 3) {
    throw new Error(`Data inválida: "${dateStr}". Formato esperado: YYYY-MM-DD.`);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Data inválida: "${dateStr}". Formato esperado: YYYY-MM-DD.`);
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Utilitário para adicionar meses a uma data sem sofrer com overflow de dias
 * (Ex: 31 de Janeiro + 1 mês -> 28/29 de Fevereiro, e não início de Março).
 * Mantém rigorosamente o horário em 12:00:00.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();

  result.setMonth(result.getMonth() + months);

  // Se o dia mudou após incrementar o mês, volta para o último dia do mês desejado
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }

  // Garante blindagem de fuso horário fixando a hora em 12:00:00
  result.setHours(12, 0, 0, 0);
  return result;
}

export class TransactionController {
  /**
   * 1. GET /transactions
   * Retorna as transações com suporte a filtros por mês/ano ou intervalo startDate/endDate.
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { month, year, startDate, endDate, type, category, status, groupId, search } = req.query;

      let dateFilter: { gte?: Date; lte?: Date } | undefined;

      // Filtro por mês e ano
      if (month && year) {
        const monthNum = parseInt(month as string, 10);
        const yearNum = parseInt(year as string, 10);

        if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
          const badRequest: ApiResponse = {
            success: false,
            message: 'Parâmetros inválidos: month deve ser entre 1 e 12 e year um ano válido.',
          };
          res.status(400).json(badRequest);
          return;
        }

        // Início e fim do mês especificado cobrindo do início do 1º dia ao último milissegundo do mês
        const startMonth = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
        const endMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

        dateFilter = {
          gte: startMonth,
          lte: endMonth,
        };
      }

      // Filtro por intervalo explícito de datas (startDate / endDate)
      if (startDate || endDate) {
        let gteDate: Date | undefined;
        let lteDate: Date | undefined;

        if (startDate) {
          try {
            const parsedStart = parseLocalDate(startDate as string);
            parsedStart.setHours(0, 0, 0, 0);
            gteDate = parsedStart;
          } catch {
            const badRequest: ApiResponse = {
              success: false,
              message: 'startDate inválido. Use o formato YYYY-MM-DD.',
            };
            res.status(400).json(badRequest);
            return;
          }
        }

        if (endDate) {
          try {
            const parsedEnd = parseLocalDate(endDate as string);
            parsedEnd.setHours(23, 59, 59, 999);
            lteDate = parsedEnd;
          } catch {
            const badRequest: ApiResponse = {
              success: false,
              message: 'endDate inválido. Use o formato YYYY-MM-DD.',
            };
            res.status(400).json(badRequest);
            return;
          }
        }

        dateFilter = {
          ...(dateFilter || {}),
          ...(gteDate ? { gte: gteDate } : {}),
          ...(lteDate ? { lte: lteDate } : {}),
        };
      }

      // Montagem dos filtros adicionais
      const where: {
        date?: { gte?: Date; lte?: Date };
        type?: TransactionType;
        category?: TransactionCategory;
        status?: PaymentStatus;
        groupId?: string;
        description?: { contains: string };
      } = {};

      if (dateFilter) where.date = dateFilter;
      if (type) where.type = type as TransactionType;
      if (category) where.category = category as TransactionCategory;
      if (status) where.status = status as PaymentStatus;
      if (groupId) where.groupId = groupId as string;
      if (search) where.description = { contains: search as string };

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { date: 'asc' },
      });

      const response: ApiResponse<typeof transactions> = {
        success: true,
        data: transactions,
      };
      res.json(response);
    } catch (error) {
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
   * Cria transação com validação Zod, arredondamento a 2 casas e regras de negócio:
   * - 'installment': Gera parcelas para os meses subsequentes vinculadas por groupId.
   * - 'fixed' ou 'recurring': Projeta registros para repeatMonths (padrão 12) vinculados por groupId.
   * - 'daily' (ou outras): Gera registro único.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      // Validação Zod do body
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

      // Conversão segura da data base com proteção de timezone
      let baseDate: Date;
      try {
        baseDate = parseLocalDate(payload.date);
      } catch (err) {
        const badRequest: ApiResponse = {
          success: false,
          message: err instanceof Error ? err.message : 'Data fornecida é inválida. Utilize YYYY-MM-DD.',
        };
        res.status(400).json(badRequest);
        return;
      }

      // REGRA 1: Categoria 'installment' (Compras parceladas)
      if (payload.category === 'installment') {
        const totalInstallments = Number(payload.totalInstallments) || 1;

        if (totalInstallments < 1) {
          const badRequest: ApiResponse = {
            success: false,
            message: 'Para categoria installment, totalInstallments deve ser maior ou igual a 1.',
          };
          res.status(400).json(badRequest);
          return;
        }

        const groupId = payload.groupId || randomUUID();
        const startInstallment = Number(payload.currentInstallment) || 1;
        const installmentsToGenerate =
          startInstallment > 1 && totalInstallments >= startInstallment
            ? totalInstallments - startInstallment + 1
            : totalInstallments;
        const transactionsToCreate = [];

        for (let i = 0; i < installmentsToGenerate; i++) {
          const installmentNumber = startInstallment + i;
          const installmentDate = addMonths(baseDate, i);
          const isFirst = i === 0;

          transactionsToCreate.push({
            id: randomUUID(),
            type: payload.type,
            category: payload.category,
            amount: payload.amount,
            description: payload.description,
            date: installmentDate,
            currentInstallment: installmentNumber,
            totalInstallments: totalInstallments,
            groupId: groupId,
            status: isFirst ? payload.status : 'pending',
            paymentDate: isFirst && payload.status === 'paid'
              ? (payload.paymentDate ? parseLocalDate(payload.paymentDate) : installmentDate)
              : null,
          });
        }

        await prisma.$transaction(
          transactionsToCreate.map((data) => prisma.transaction.create({ data }))
        );

        const response: ApiResponse<{ groupId: string; count: number; items: typeof transactionsToCreate }> = {
          success: true,
          message: `${transactionsToCreate.length} parcelas geradas com sucesso.`,
          data: {
            groupId,
            count: transactionsToCreate.length,
            items: transactionsToCreate,
          },
        };
        res.status(201).json(response);
        return;
      }

      // REGRA 2: Categorias 'fixed' (Fixas) e 'recurring' (Recorrentes)
      // Gera projeção mensal vinculada por groupId (padrão 12 meses ou valor de repeatMonths)
      if (payload.category === 'fixed' || payload.category === 'recurring') {
        const repeatCount = payload.repeatMonths ?? 12;
        const groupId = payload.groupId || randomUUID();
        const transactionsToCreate = [];

        for (let i = 0; i < repeatCount; i++) {
          const txDate = addMonths(baseDate, i);
          const isFirst = i === 0;

          transactionsToCreate.push({
            id: randomUUID(),
            type: payload.type,
            category: payload.category,
            amount: payload.amount,
            description: payload.description,
            date: txDate,
            currentInstallment: null,
            totalInstallments: null,
            groupId: groupId,
            status: isFirst ? payload.status : 'pending',
            paymentDate: isFirst && payload.status === 'paid'
              ? (payload.paymentDate ? parseLocalDate(payload.paymentDate) : txDate)
              : null,
          });
        }

        await prisma.$transaction(
          transactionsToCreate.map((data) => prisma.transaction.create({ data }))
        );

        const response: ApiResponse<{ groupId: string; count: number; items: typeof transactionsToCreate }> = {
          success: true,
          message: `${transactionsToCreate.length} transações (${payload.category}) geradas com sucesso para os próximos ${repeatCount} meses.`,
          data: {
            groupId,
            count: transactionsToCreate.length,
            items: transactionsToCreate,
          },
        };
        res.status(201).json(response);
        return;
      }

      // REGRA 3: Demais categorias (ex: 'daily' / despesas cotidianas ou avulsas)
      const isPaid = payload.status === 'paid';
      const singleTransaction = await prisma.transaction.create({
        data: {
          type: payload.type,
          category: payload.category,
          amount: payload.amount,
          description: payload.description,
          date: baseDate,
          currentInstallment: payload.currentInstallment ?? null,
          totalInstallments: payload.totalInstallments ?? null,
          groupId: payload.groupId ?? null,
          status: payload.status,
          paymentDate: isPaid
            ? (payload.paymentDate ? parseLocalDate(payload.paymentDate) : baseDate)
            : null,
        },
      });

      const response: ApiResponse<typeof singleTransaction> = {
        success: true,
        message: 'Transação criada com sucesso.',
        data: singleTransaction,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao processar transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(400).json(response);
    }
  }

  /**
   * 3. PUT /transactions/:id
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
      const updateData: {
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

      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.amount !== undefined) updateData.amount = payload.amount;
      if (payload.category !== undefined) updateData.category = payload.category;
      if (payload.type !== undefined) updateData.type = payload.type;
      if (payload.currentInstallment !== undefined) updateData.currentInstallment = payload.currentInstallment;
      if (payload.totalInstallments !== undefined) updateData.totalInstallments = payload.totalInstallments;
      if (payload.groupId !== undefined) updateData.groupId = payload.groupId;

      if (payload.date !== undefined) {
        try {
          updateData.date = parseLocalDate(payload.date);
        } catch (err) {
          res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : 'Data inválida.',
          });
          return;
        }
      }

      if (payload.status !== undefined) {
        updateData.status = payload.status;
        if (payload.status === 'paid') {
          if (payload.paymentDate) {
            updateData.paymentDate = parseLocalDate(payload.paymentDate);
          } else if (existing.paymentDate) {
            updateData.paymentDate = existing.paymentDate;
          } else {
            const now = new Date();
            updateData.paymentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
          }
        } else {
          updateData.paymentDate = null;
        }
      } else if (payload.paymentDate !== undefined) {
        updateData.paymentDate = payload.paymentDate ? parseLocalDate(payload.paymentDate) : null;
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: updateData,
      });

      const response: ApiResponse<typeof updatedTransaction> = {
        success: true,
        message: 'Transação atualizada com sucesso.',
        data: updatedTransaction,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao atualizar transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 4. PATCH /transactions/:id/status
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

      let newPaymentDate: Date | null = null;
      if (newStatus === 'paid') {
        if (requestedPaymentDate) {
          newPaymentDate = parseLocalDate(requestedPaymentDate);
        } else {
          // Preenchimento automático com o meio-dia da data atual
          const now = new Date();
          newPaymentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
        }
      } else {
        // Se 'pending' ou 'overdue', remove paymentDate
        newPaymentDate = null;
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id },
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
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao atualizar status da transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }

  /**
   * 5. DELETE /transactions/:id
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

      // Se deleteAll for true e possuir um groupId, apaga todas as parcelas/recorrências futuras
      if (deleteAll && targetTransaction.groupId) {
        const deleteCondition = targetTransaction.currentInstallment !== null
          ? {
              groupId: targetTransaction.groupId,
              currentInstallment: { gte: targetTransaction.currentInstallment },
            }
          : {
              groupId: targetTransaction.groupId,
              date: { gte: targetTransaction.date },
            };

        const deleteResult = await prisma.transaction.deleteMany({
          where: deleteCondition,
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
        where: { id },
      });

      const response: ApiResponse<typeof targetTransaction> = {
        success: true,
        message: 'Transação removida com sucesso.',
        data: targetTransaction,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao excluir transação.',
        errors: [error instanceof Error ? error.message : 'Erro interno'],
      };
      res.status(500).json(response);
    }
  }
}
