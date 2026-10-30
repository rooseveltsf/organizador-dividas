/**
 * @organizador/shared
 * Contratos de dados, tipos e interfaces compartilhados entre API e Frontend.
 */

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
// Entidade e DTOs de Perfil de Usuário
// ============================================================================

export interface Profile {
  /** Identificador único do perfil (UUID) */
  id: string;

  /** Nome do titular do perfil */
  name: string;

  /** Iniciais para renderização em avatares (ex: "RS", "JD") */
  avatarInitials: string;

  /** Cor primária do perfil em hexadecimal (ex: "#6366F1") */
  primaryColor: string;

  /** Cor secundária do perfil em hexadecimal para gradientes e destaques (ex: "#EC4899") */
  secondaryColor: string;

  /** Data de criação em formato ISO 8601 */
  createdAt: string;

  /** Data da última atualização em formato ISO 8601 */
  updatedAt: string;
}

export interface CreateProfileDTO {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  avatarInitials?: string;
}

export type UpdateProfileDTO = Partial<CreateProfileDTO>;

// ============================================================================
// Entidade Principal: Transaction
// ============================================================================

export interface Transaction {
  /** Identificador único da transação (UUID) */
  id: string;

  /** Identificador do perfil ao qual a transação pertence (UUID) */
  profileId: string;

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
  profileId: string;
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
  profileId?: string;
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
  profileId?: string;
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  category?: TransactionCategory;
  status?: PaymentStatus;
  groupId?: string;
  search?: string;
}

// ============================================================================
// Contratos de Leitura e Importação de Contracheque (Holerite)
// ============================================================================

export interface PayslipExtractedItem {
  tempId: string;
  rawCode?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  suggestedCategory: 'fixed' | 'recurring' | 'installment' | 'daily';
  currentInstallment?: number;
  totalInstallments?: number;
  selected: boolean;
}

export interface PayslipParseResult {
  employerName?: string;
  referenceMonth?: string; // Formato YYYY-MM
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  items: PayslipExtractedItem[];
  rawTextPreview: string;
}

export interface BatchCreateTransactionDTO {
  profileId: string;
  repeatMonths?: number;
  transactions: Omit<CreateTransactionDTO, 'profileId'>[];
}

// ============================================================================
// Schemas de Validação (Zod) e Tipos Inferidos
// ============================================================================

export const createProfileSchema = z.object({
  name: z.string().trim().min(1, 'O nome do perfil é obrigatório'),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor primária deve ser um valor hexadecimal válido (ex: #6366F1)'),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor secundária deve ser um valor hexadecimal válido (ex: #EC4899)'),
  avatarInitials: z.string().trim().min(1).max(4).optional(),
});

export const updateProfileSchema = createProfileSchema.partial();

export const createTransactionSchema = z.object({
  profileId: z.string().min(1, 'O profileId é obrigatório'),
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
  profileId: z.string().min(1).optional(),
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

export const payslipExtractedItemSchema = z.object({
  tempId: z.string(),
  rawCode: z.string().optional(),
  description: z.string().trim().min(1, 'A descrição é obrigatória'),
  amount: z.coerce.number().positive('O valor deve ser positivo'),
  type: z.enum(['income', 'expense']),
  suggestedCategory: z.enum(['fixed', 'recurring', 'installment', 'daily']),
  currentInstallment: z.coerce.number().int().positive().optional().nullable(),
  totalInstallments: z.coerce.number().int().positive().optional().nullable(),
  selected: z.boolean(),
});

export const batchCreateTransactionSchema = z.object({
  profileId: z.string().min(1, 'O profileId é obrigatório'),
  repeatMonths: z.coerce.number().int().min(1).optional(),
  transactions: z.array(
    createTransactionSchema.omit({ profileId: true }).extend({
      repeatMonths: z.coerce.number().int().min(1).optional(),
    })
  ),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type PayslipExtractedItemInput = z.infer<typeof payslipExtractedItemSchema>;
export type BatchCreateTransactionInput = z.infer<typeof batchCreateTransactionSchema>;

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
