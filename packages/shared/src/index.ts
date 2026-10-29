/**
 * @organizador/shared
 * Contratos de dados, tipos e interfaces compartilhados entre API e Frontend.
 */

// ============================================================================
// Tipos Fundamentais de Transação
// ============================================================================

import { z } from 'zod';

// ============================================================================
// Tipos Fundamentais de Transação
// ============================================================================

export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'fixed'        // Despesas/Receitas fixas (ex: aluguel, condomínio, salário fixo)
  | 'recurring'    // Recorrentes/assinaturas (ex: streaming, internet, academia)
  | 'installment'  // Parceladas (ex: cartão de crédito em 10x, empréstimos)
  | 'daily';       // Variáveis/cotidianas (ex: alimentação, transporte diário, lazer)

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

// ============================================================================
// Entidade Principal: Transaction
// ============================================================================

export interface Transaction {
  /** Identificador único da transação (UUID) */
  id: string;

  /** Tipo da transação: entrada de dinheiro ou saída/gasto */
  type: TransactionType;

  /** Classificação do modelo de recorrência/natureza da transação */
  category: TransactionCategory;

  /** Valor monetário (sempre positivo, a distinção é feita pelo tipo) */
  amount: number;

  /** Descrição detalhada da transação */
  description: string;

  /** Data de competência ou vencimento no formato ISO 8601 (YYYY-MM-DD ou completo) */
  date: string;

  /** Número da parcela atual (obrigatório ou recomendado para categoria 'installment') */
  currentInstallment?: number;

  /** Quantidade total de parcelas (obrigatório ou recomendado para categoria 'installment') */
  totalInstallments?: number;

  /** Identificador do agrupamento (vincula todas as parcelas da mesma dívida/compra) */
  groupId?: string;

  /** Estado do pagamento */
  status?: PaymentStatus;

  /** Data efetiva de liquidação/pagamento */
  paymentDate?: string | null;

  /** Timestamps de auditoria */
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/** Payload para criação de uma transação avulsa, parcelamento ou projeção fixa/recorrente */
export interface CreateTransactionDTO {
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  date: string;
  currentInstallment?: number;
  totalInstallments?: number;
  groupId?: string;
  status?: PaymentStatus;
  paymentDate?: string | null;
  /** Quantidade de meses a projetar caso category seja 'fixed' ou 'recurring' (padrão: 12) */
  repeatMonths?: number;
}

/** Payload para criação em lote de parcelas vinculadas */
export interface CreateInstallmentGroupDTO {
  description: string;
  totalAmount: number;
  totalInstallments: number;
  startDate: string;
  type?: 'expense';
  status?: PaymentStatus;
}

/** Payload para atualização de transação */
export type UpdateTransactionDTO = Partial<CreateTransactionDTO>;

/** Filtros para listagem e busca */
export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  category?: TransactionCategory;
  status?: PaymentStatus;
  groupId?: string;
  search?: string;
}

// ============================================================================
// Schemas de Validação (Zod) e Tipos Inferidos
// ============================================================================

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense'], {
    message: "O tipo deve ser 'income' ou 'expense'",
  }),
  category: z.enum(['fixed', 'recurring', 'installment', 'daily'], {
    message: "A categoria deve ser 'fixed', 'recurring', 'installment' ou 'daily'",
  }),
  amount: z.coerce
    .number({ message: 'O valor deve ser um número válido' })
    .positive('O valor deve ser positivo')
    .transform((val) => Math.round(val * 100) / 100),
  description: z.string().trim().min(1, 'A descrição é obrigatória'),
  date: z.string().min(1, 'A data é obrigatória'),
  currentInstallment: z.coerce.number().int().positive().optional().nullable(),
  totalInstallments: z.coerce.number().int().positive().optional().nullable(),
  groupId: z.string().optional().nullable(),
  status: z.enum(['pending', 'paid', 'overdue']).optional().default('pending'),
  paymentDate: z.string().nullable().optional(),
  repeatMonths: z.coerce.number().int().min(1, 'repeatMonths deve ser no mínimo 1').optional().default(12),
});

export const updateTransactionSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.enum(['fixed', 'recurring', 'installment', 'daily']).optional(),
  amount: z.coerce
    .number({ message: 'O valor deve ser um número válido' })
    .positive('O valor deve ser positivo')
    .transform((val) => Math.round(val * 100) / 100)
    .optional(),
  description: z.string().trim().min(1, 'A descrição não pode ser vazia').optional(),
  date: z.string().min(1, 'Data inválida').optional(),
  currentInstallment: z.coerce.number().int().positive().optional().nullable(),
  totalInstallments: z.coerce.number().int().positive().optional().nullable(),
  groupId: z.string().optional().nullable(),
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  paymentDate: z.string().nullable().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  paymentDate: z.string().nullable().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ============================================================================
// Métricas e Resumos Financeiros
// ============================================================================

export interface FinancialOverview {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  totalPendingExpense: number;
  totalOverdueExpense: number;
}

export interface InstallmentGroupSummary {
  groupId: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  nextDueDate?: string;
  isCompleted: boolean;
}

// ============================================================================
// Padrões de Resposta de API
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
