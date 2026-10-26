import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '../server';
import {
  ApiResponse,
  CreateTransactionDTO,
  Transaction as ITransaction
} from '@organizador/shared';

/**
 * Utilitário para adicionar meses a uma data sem sofrer com overflow de dias
 * (Ex: 31 de Janeiro + 1 mês -> 28/29 de Fevereiro, e não 2 ou 3 de Março).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();

  result.setMonth(result.getMonth() + months);

  // Se o dia mudou após incrementar o mês, volta para o último dia do mês desejado
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }
  return result;
}

export class TransactionController {
  /**
   * 1. GET /transactions
   * Retorna as transações filtradas por mês e ano (se fornecidos), ordenadas por data.
   */
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { month, year } = req.query;

      let dateFilter: { gte?: Date; lte?: Date } | undefined;

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

        // Início e fim do mês especificado
        const startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

        dateFilter = {
          gte: startDate,
          lte: endDate,
        };
      }

      const transactions = await prisma.transaction.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
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
   * Cria transação com regra de negócio para parcelamento.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as CreateTransactionDTO;

      if (!payload.type || !payload.category || !payload.amount || !payload.description || !payload.date) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Campos obrigatórios ausentes: type, category, amount, description, date.',
        };
        res.status(400).json(badRequest);
        return;
      }

      const baseDate = new Date(payload.date);
      if (isNaN(baseDate.getTime())) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Data fornecida é inválida. Utilize o formato ISO (ex: YYYY-MM-DD).',
        };
        res.status(400).json(badRequest);
        return;
      }

      // REGRA: Categoria 'installment' (Parcelada)
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

        const transactionsToCreate = [];

        for (let i = 0; i < totalInstallments; i++) {
          const installmentNumber = startInstallment + i;
          const installmentDate = addMonths(baseDate, i);

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
            status: payload.status || 'pending',
            paymentDate: payload.paymentDate && i === 0 ? new Date(payload.paymentDate) : null,
          });
        }

        // Persistência em lote dentro de uma transação atômica do Prisma
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

      // REGRA: Outras categorias (registro único)
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
          status: payload.status || 'pending',
          paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : null,
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
   * 3. DELETE /transactions/:id
   * Exclui transação individual ou todas as parcelas futuras se ?deleteAll=true e groupId existir.
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

      // Se deleteAll for true e possuir um groupId, apaga todas as parcelas futuras
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
          message: `${deleteResult.count} parcela(s) futura(s) removida(s) com sucesso.`,
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
