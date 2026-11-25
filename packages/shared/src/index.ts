/**
 * @organizador/shared
 * Contratos de dados, tipos e interfaces compartilhados entre API e Frontend.
 */

import { z } from 'zod';
import { addMonths, parseCalendarDate } from './calendar';
import { toCents, validMoneyCents } from './money';

export { addMonths, calendarDay, calendarMonthRange, parseCalendarDate } from './calendar';
export { installmentCents, toCents, validMoneyCents } from './money';

export const MAX_SERIES_LENGTH = 120;

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

  hasPin: boolean;
}

export interface ProfileDetails extends Profile {
  createdAt: string;
  updatedAt: string;
  pendingCountCurrentMonth: number;
  pendingAmountCurrentMonth: number;
}

export interface ProfileSession {
  token: string;
  expiresAt: string;
  expiresInMs: number;
}

export interface ProfileSessionStatus {
  profile: Profile;
  session?: Omit<ProfileSession, 'token'>;
}

export interface CreateProfileDTO {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  avatarInitials?: string;
  pin?: string;
  pinConfirmation?: string;
}

export type UpdateProfileDTO = Partial<Omit<CreateProfileDTO, 'pin' | 'pinConfirmation'>>;

export type UpdateProfilePinDTO =
  | { pin: string; pinConfirmation: string; currentPin?: string }
  | { pin: null; currentPin: string };

export const profilePinSchema = z.string().length(4).regex(/^[0-9]{4}$/, 'Use quatro dígitos de 0 a 9.');

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
  currentInstallment?: number | null;

  /** Quantidade total de parcelas (obrigatório ou recomendado para categoria 'installment') */
  totalInstallments?: number | null;

  /** Identificador do agrupamento (vincula todas as parcelas da mesma dívida/compra) */
  groupId?: string | null;

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
  /** Em parcelas, 'total' indica o valor de toda a compra. O padrão é o valor unitário. */
  amountMode?: 'unit' | 'total';
  description: string;
  date: string;
  currentInstallment?: number | null;
  totalInstallments?: number | null;
  groupId?: string | null;
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
export type UpdateTransactionDTO = Partial<Omit<CreateTransactionDTO, 'repeatMonths' | 'amountMode'>>;

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
  reference?: string;
  amount: number;
  type: 'income' | 'expense';
  suggestedCategory: 'fixed' | 'recurring' | 'installment' | 'daily';
  currentInstallment?: number;
  totalInstallments?: number;
  isAdvance?: boolean;
  suggestedDate?: string;
  selected: boolean;
}

export interface PayslipParseResult {
  employerName?: string;
  referenceMonth?: string; // Formato YYYY-MM
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  hasAdvancePayment?: boolean;
  advanceAmount?: number;
  advanceDate?: string;
  netBalanceDate?: string;
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

const profileIdentitySchema = z.object({
  name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres'),
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

export const createProfileSchema = profileIdentitySchema.extend({
  pin: profilePinSchema.optional(),
  pinConfirmation: profilePinSchema.optional(),
}).refine(({ pin, pinConfirmation }) => pin === pinConfirmation, {
  message: 'Confirme o mesmo PIN de quatro dígitos.',
  path: ['pinConfirmation'],
});

export const updateProfileSchema = profileIdentitySchema.partial();

export const calendarDateSchema = z.string().trim().pipe(
  z.union([z.iso.date(), z.iso.datetime({ offset: true, local: true })],
    { error: 'Informe uma data válida no formato YYYY-MM-DD ou ISO 8601.' })
);

const paymentDateSchema = calendarDateSchema.nullable().optional();
const numberInput = z.union([z.number(), z.string().trim().min(1).transform(Number)]);
const amountSchema = numberInput
  .transform(toCents)
  .refine(validMoneyCents, 'Informe um valor positivo em reais representável em centavos.')
  .transform(cents => cents / 100);
const seriesLength = numberInput.pipe(z.number().int().min(1).max(MAX_SERIES_LENGTH));
const installmentNumber = seriesLength.optional().nullable();

const createTransactionFields = z.object({
  profileId: z.string().min(1, 'O profileId é obrigatório'),
  type: z.enum(['income', 'expense'], {
    message: "O tipo deve ser 'income' ou 'expense'",
  }),
  category: z.enum(['fixed', 'recurring', 'installment', 'daily'], {
    message: "A categoria deve ser 'fixed', 'recurring', 'installment' ou 'daily'",
  }),
  amount: amountSchema,
  amountMode: z.enum(['unit', 'total']).optional(),
  description: z.string().trim().min(1, 'A descrição é obrigatória'),
  date: calendarDateSchema,
  currentInstallment: installmentNumber,
  totalInstallments: installmentNumber,
  groupId: z.string().optional().nullable(),
  status: z.enum(['pending', 'paid', 'overdue']).optional().default('pending'),
  paymentDate: paymentDateSchema,
  repeatMonths: seriesLength.optional(),
});

type TransactionSeries = Pick<CreateTransactionDTO, 'category' | 'currentInstallment' | 'totalInstallments'>;

export function transactionCount(item: TransactionSeries, repeatMonths: number): number {
  if (item.category === 'installment') return (item.totalInstallments ?? 1) - (item.currentInstallment ?? 1) + 1;
  if (item.category === 'fixed' || item.category === 'recurring') return repeatMonths;
  return 1;
}

function validateProjection(
  item: Omit<z.infer<typeof createTransactionFields>, 'profileId'>,
  repeatMonths: number,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
) {
  const count = transactionCount(item, repeatMonths);
  if (count < 1) {
    ctx.addIssue({ code: 'custom', path: [...path, 'currentInstallment'],
      message: 'A parcela atual deve estar entre 1 e o total de parcelas.' });
  }
  if (item.amountMode === 'total') {
    if (item.category !== 'installment') {
      ctx.addIssue({ code: 'custom', path: [...path, 'amountMode'],
        message: 'O valor total da compra é aplicável a parcelamentos.' });
    } else if (toCents(item.amount) < (item.totalInstallments ?? 1)) {
      ctx.addIssue({ code: 'custom', path: [...path, 'amount'],
        message: 'Cada parcela precisa valer pelo menos R$ 0,01.' });
    }
  }
  if (count > 1 && addMonths(parseCalendarDate(item.date), count - 1).getUTCFullYear() > 9999) {
    ctx.addIssue({ code: 'custom', path: [...path, 'date'],
      message: 'A projeção ultrapassa o ano máximo de 9999.' });
  }
}

export const createTransactionSchema = createTransactionFields.extend({
  repeatMonths: seriesLength.default(12),
}).superRefine((item, ctx) => validateProjection(item, item.repeatMonths, ctx));

export const updateTransactionSchema = z.object({
  profileId: z.string().min(1).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.enum(['fixed', 'recurring', 'installment', 'daily']).optional(),
  amount: amountSchema.optional(),
  description: z.string().trim().min(1, 'A descrição não pode ser vazia').optional(),
  date: calendarDateSchema.optional(),
  currentInstallment: installmentNumber,
  totalInstallments: installmentNumber,
  groupId: z.string().optional().nullable(),
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  paymentDate: paymentDateSchema,
}).refine(
  item => item.currentInstallment == null || item.totalInstallments == null ||
    item.currentInstallment <= item.totalInstallments,
  { path: ['currentInstallment'], message: 'A parcela atual deve estar entre 1 e o total de parcelas.' },
);

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  paymentDate: paymentDateSchema,
});

export const payslipExtractedItemSchema = z.object({
  tempId: z.string(),
  rawCode: z.string().optional(),
  description: z.string().trim().min(1, 'A descrição é obrigatória'),
  reference: z.string().optional(),
  amount: z.coerce.number().positive('O valor deve ser positivo'),
  type: z.enum(['income', 'expense']),
  suggestedCategory: z.enum(['fixed', 'recurring', 'installment', 'daily']),
  currentInstallment: z.coerce.number().int().positive().optional().nullable(),
  totalInstallments: z.coerce.number().int().positive().optional().nullable(),
  isAdvance: z.boolean().optional(),
  suggestedDate: z.string().optional(),
  selected: z.boolean(),
});

export const batchCreateTransactionSchema = z.object({
  profileId: z.string().min(1, 'O profileId é obrigatório'),
  repeatMonths: seriesLength.optional(),
  transactions: z.array(createTransactionFields.omit({ profileId: true }))
    .min(1, 'Informe pelo menos uma transação.'),
}).superRefine((batch, ctx) => {
  batch.transactions.forEach((item, index) => {
    validateProjection(item, batch.repeatMonths ?? item.repeatMonths ?? 1, ctx, ['transactions', index]);
  });
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
