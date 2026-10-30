import React, { useState } from 'react';
import { useTransactions } from '../contexts/TransactionContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Modal,
} from '../components/ui';
import { TransactionForm } from '../components/TransactionForm';
import type { Transaction } from '@organizador/shared';
import { css } from '@/styled-system/css';
import {
  Wallet,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Pencil,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  fixed: 'Fixa',
  recurring: 'Recorrente',
  installment: 'Parcelada',
  daily: 'Cotidiana',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

// ============================================================================
// Estilos Panda CSS para o Dashboard (Zero inline styles)
// ============================================================================

const pageContainerStyle = css({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: { base: '4', md: '8' },
  minHeight: '100vh',
});

const headerStyle = css({
  display: 'flex',
  flexDirection: { base: 'column', sm: 'row' },
  justifyContent: 'space-between',
  alignItems: { base: 'stretch', sm: 'center' },
  gap: '4',
  marginBottom: '8',
});

const headerTitleStyle = css({
  fontSize: '2xl',
  fontWeight: '800',
  color: 'slate.900',
  letterSpacing: '-0.025em',
  margin: '0',
});

const headerSubtitleStyle = css({
  color: 'slate.500',
  fontSize: 'sm',
  marginTop: '1',
  margin: '0',
});

const monthPickerContainerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  backgroundColor: 'white',
  paddingY: '1.5',
  paddingX: '2',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
});

const monthPickerLabelStyle = css({
  fontWeight: 'semibold',
  fontSize: 'sm',
  color: 'slate.800',
  minWidth: '150px',
  textAlign: 'center',
});

const cardsGridStyle = css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',
    sm: 'repeat(2, 1fr)',
    lg: 'repeat(4, 1fr)',
  },
  gap: '4',
  marginBottom: '8',
});

const mainGridStyle = css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',
    lg: '380px 1fr',
  },
  gap: '6',
  alignItems: 'start',
});

const cardHeaderRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const iconBadgeStyle = (colorType: 'income' | 'expense' | 'neutral') =>
  css({
    backgroundColor:
      colorType === 'income' ? 'income.50' : colorType === 'expense' ? 'expense.50' : 'slate.100',
    color:
      colorType === 'income' ? 'income.600' : colorType === 'expense' ? 'expense.600' : 'slate.600',
    padding: '2',
    borderRadius: 'lg',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

const cardValueStyle = (colorType: 'income' | 'expense' | 'neutral') =>
  css({
    color:
      colorType === 'income' ? 'income.600' : colorType === 'expense' ? 'expense.600' : 'slate.800',
    fontSize: '2xl',
    fontWeight: 'bold',
    marginTop: '2',
  });

const cardFooterStatsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  width: '100%',
  fontSize: 'xs',
});

const cardFooterRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  width: '100%',
});

const statLabelStyle = css({
  color: 'slate.500',
});

const statValueStyle = (colorType?: 'income' | 'expense' | 'warning' | 'neutral') =>
  css({
    fontWeight: 'semibold',
    color:
      colorType === 'income'
        ? 'income.700'
        : colorType === 'expense'
          ? 'expense.700'
          : colorType === 'warning'
            ? 'warning.600'
            : 'slate.700',
  });

const filterBarContainerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '3',
});

const filterTabGroupStyle = css({
  display: 'flex',
  gap: '1',
  backgroundColor: 'slate.100',
  padding: '1',
  borderRadius: 'lg',
});

const filterTabButtonStyle = css({
  height: '7',
  fontSize: 'xs',
  paddingX: '2.5',
});

const transactionsListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
});

const transactionItemCardStyle = (isPaid: boolean, isOverdue: boolean) =>
  css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4',
    borderRadius: 'xl',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: isOverdue ? 'expense.300' : isPaid ? 'slate.200' : 'slate.200',
    borderLeftWidth: isOverdue ? '4px' : '1px',
    borderLeftColor: isOverdue ? 'expense.500' : undefined,
    backgroundColor: isPaid ? 'slate.50' : 'white',
    transition: 'all 0.2s ease-in-out',
    gap: '3',
    _hover: {
      borderColor: isOverdue ? 'expense.400' : 'slate.300',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    },
  });

const statusToggleButtonStyle = (isPaid: boolean) =>
  css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5',
    borderRadius: 'lg',
    backgroundColor: isPaid ? 'income.50' : 'transparent',
    color: isPaid ? 'income.600' : 'slate.400',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: isPaid ? 'income.200' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    flexShrink: 0,
    _hover: {
      backgroundColor: isPaid ? 'income.100' : 'slate.100',
      color: isPaid ? 'income.700' : 'income.600',
      borderColor: isPaid ? 'income.300' : 'slate.300',
    },
  });

const transactionTypeIconStyle = (isIncome: boolean, isPaid: boolean) =>
  css({
    backgroundColor: isIncome ? 'income.50' : 'expense.50',
    color: isIncome ? 'income.600' : 'expense.600',
    padding: '2',
    borderRadius: 'lg',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isPaid ? 0.75 : 1,
    flexShrink: 0,
  });

const transactionDetailsStyle = css({
  flex: '1',
  minWidth: 0,
});

const transactionTitleRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  flexWrap: 'wrap',
});

const transactionTitleStyle = (isPaid: boolean) =>
  css({
    color: isPaid ? 'slate.500' : 'slate.900',
    fontSize: 'sm',
    fontWeight: 'semibold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textDecoration: isPaid ? 'line-through' : 'none',
  });

const installmentBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  backgroundColor: 'brand.50',
  color: 'brand.700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'brand.100',
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'md',
  fontSize: 'xs',
  fontWeight: 'semibold',
});

const categoryBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: 'slate.100',
  color: 'slate.700',
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'md',
  fontSize: 'xs',
  fontWeight: 'medium',
});

const statusBadgePaidStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  backgroundColor: 'income.50',
  color: 'income.700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'income.200',
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'md',
  fontSize: 'xs',
  fontWeight: 'semibold',
});

const statusBadgeOverdueStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  backgroundColor: 'expense.50',
  color: 'expense.700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'expense.200',
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'md',
  fontSize: 'xs',
  fontWeight: 'semibold',
});

const statusBadgePendingStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  backgroundColor: 'slate.100',
  color: 'slate.600',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  paddingX: '2',
  paddingY: '0.5',
  borderRadius: 'md',
  fontSize: 'xs',
  fontWeight: 'medium',
});

const transactionMetaRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  fontSize: 'xs',
  color: 'slate.500',
  marginTop: '1',
});

const transactionAmountAreaStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  textAlign: 'right',
  flexShrink: 0,
});

const transactionAmountStyle = (isIncome: boolean, isPaid: boolean) =>
  css({
    color: isPaid ? 'slate.400' : isIncome ? 'income.600' : 'expense.600',
    fontWeight: 'bold',
    fontSize: 'sm',
    whiteSpace: 'nowrap',
  });

const actionButtonGhostStyle = (variant: 'edit' | 'delete') =>
  css({
    color: 'slate.400',
    padding: '1.5',
    height: '8',
    width: '8',
    borderRadius: 'lg',
    _hover: {
      backgroundColor: variant === 'delete' ? 'expense.50' : 'brand.50',
      color: variant === 'delete' ? 'expense.600' : 'brand.600',
    },
  });

const emptyStateContainerStyle = css({
  textAlign: 'center',
  padding: '12',
  color: 'slate.400',
  backgroundColor: 'slate.50',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'slate.300',
});

const emptyStateTextStyle = css({
  fontWeight: 'medium',
  color: 'slate.600',
  margin: '0',
});

const emptyStateSubtextStyle = css({
  fontSize: 'xs',
  color: 'slate.400',
  marginTop: '1',
});

const modalAlertBoxStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '3',
  padding: '3.5',
  borderRadius: 'xl',
  backgroundColor: 'expense.50',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'expense.200',
  color: 'expense.800',
  fontSize: 'sm',
  lineHeight: '1.4',
  marginBottom: '4',
});

const modalButtonGroupStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '3',
  marginTop: '4',
});

const modalGroupSeriesActionsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5',
  marginTop: '4',
  width: '100%',
});

const footerPaginationInfoStyle = css({
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 'xs',
  color: 'slate.400',
});

export const Dashboard: React.FC = () => {
  const {
    transactions,
    isLoading,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    deleteTransaction,
    toggleTransactionStatus,
  } = useTransactions();

  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Transaction | null>(null);

  // Data atual no formato YYYY-MM-DD para detecção de contas em atraso
  const todayStr = new Date().toISOString().split('T')[0];

  // ==========================================================================
  // Processamento com reduce dos 4 cards de métricas (Totais, Pagos e Pendentes)
  // ==========================================================================

  // 1. Entradas
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const paidIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const pendingIncome = totalIncome - paidIncome;

  // 2. Saídas Totais
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const paidExpense = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const pendingExpense = totalExpense - paidExpense;

  // 3. Saldo Livre (Totais, Realizado e Pendente)
  const freeBalance = totalIncome - totalExpense;
  const realizedBalance = paidIncome - paidExpense;
  const pendingBalance = pendingIncome - pendingExpense;

  // 4. Despesas do dia a dia (daily + fixed)
  const dailyFixedTotal = transactions
    .filter(
      (t) =>
        t.type === 'expense' && (t.category === 'daily' || t.category === 'fixed')
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const dailyFixedPaid = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        (t.category === 'daily' || t.category === 'fixed') &&
        t.status === 'paid'
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const dailyFixedPending = dailyFixedTotal - dailyFixedPaid;

  // 5. Faturas/Parcelamentos (installment + recurring)
  const installmentRecurringTotal = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        (t.category === 'installment' || t.category === 'recurring')
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const installmentRecurringPaid = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        (t.category === 'installment' || t.category === 'recurring') &&
        t.status === 'paid'
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const installmentRecurringPending = installmentRecurringTotal - installmentRecurringPaid;

  // Navegação de meses
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Filtragem de transações na listagem
  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === 'income') return tx.type === 'income';
    if (activeTab === 'expense') return tx.type === 'expense';
    return true;
  });

  return (
    <div className={pageContainerStyle}>
      {/* Cabeçalho da Aplicação */}
      <header className={headerStyle}>
        <div>
          <h1 className={headerTitleStyle}>Organizador de Dívidas</h1>
          <p className={headerSubtitleStyle}>
            Painel financeiro mensal e controle de parcelamentos
          </p>
        </div>

        {/* Ações do Cabeçalho: Botão de Nova Receita + Seletor de Mês/Ano */}
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' })}>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setEditingIncome(null);
              setIsIncomeModalOpen(true);
            }}
            className={css({
              backgroundColor: 'income.600',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              paddingX: '3.5',
              height: '9',
              fontSize: 'xs',
              fontWeight: 'semibold',
              _hover: { backgroundColor: 'income.700' },
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            })}
          >
            <TrendingUp size={16} />
            <span>+ Nova Receita</span>
          </Button>

          {/* Seletor de Mês/Ano */}
          <div className={monthPickerContainerStyle}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
              className={css({ paddingX: '2', height: '7' })}
            >
              <ChevronLeft size={16} />
            </Button>

            <span className={monthPickerLabelStyle}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleNextMonth}
              aria-label="Próximo mês"
              className={css({ paddingX: '2', height: '7' })}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* 4 Cards de Métricas com Status Detalhado Pago/Pendente */}
      <section className={cardsGridStyle} aria-label="Resumo Financeiro">
        {/* 1. Saldo Livre */}
        <Card variant="elevated">
          <CardHeader>
            <div className={cardHeaderRowStyle}>
              <CardDescription>Saldo Livre</CardDescription>
              <div
                className={iconBadgeStyle(
                  freeBalance >= 0 ? 'income' : 'expense'
                )}
              >
                <Wallet size={18} />
              </div>
            </div>
            <CardTitle
              className={cardValueStyle(
                freeBalance >= 0 ? 'income' : 'expense'
              )}
            >
              {formatCurrency(freeBalance)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <div className={cardFooterStatsStyle}>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Realizado:</span>
                <span
                  className={statValueStyle(
                    realizedBalance >= 0 ? 'income' : 'expense'
                  )}
                >
                  {formatCurrency(realizedBalance)}
                </span>
              </div>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Pendente previsto:</span>
                <span
                  className={statValueStyle(
                    pendingBalance >= 0 ? 'neutral' : 'warning'
                  )}
                >
                  {formatCurrency(pendingBalance)}
                </span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* 2. Total de Entradas */}
        <Card variant="elevated">
          <CardHeader>
            <div className={cardHeaderRowStyle}>
              <CardDescription>Total de Entradas</CardDescription>
              <div className={iconBadgeStyle('income')}>
                <TrendingUp size={18} />
              </div>
            </div>
            <CardTitle className={cardValueStyle('income')}>
              {formatCurrency(totalIncome)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <div className={cardFooterStatsStyle}>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Recebido:</span>
                <span className={statValueStyle('income')}>
                  {formatCurrency(paidIncome)}
                </span>
              </div>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>A receber:</span>
                <span className={statValueStyle('neutral')}>
                  {formatCurrency(pendingIncome)}
                </span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* 3. Despesas do Dia a Dia (daily + fixed) */}
        <Card variant="elevated">
          <CardHeader>
            <div className={cardHeaderRowStyle}>
              <CardDescription>Despesas do Dia a Dia</CardDescription>
              <div className={iconBadgeStyle('neutral')}>
                <ShoppingBag size={18} />
              </div>
            </div>
            <CardTitle className={cardValueStyle('neutral')}>
              {formatCurrency(dailyFixedTotal)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <div className={cardFooterStatsStyle}>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Pago:</span>
                <span className={statValueStyle('income')}>
                  {formatCurrency(dailyFixedPaid)}
                </span>
              </div>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Pendente:</span>
                <span className={statValueStyle('expense')}>
                  {formatCurrency(dailyFixedPending)}
                </span>
              </div>
            </div>
          </CardFooter>
        </Card>

        {/* 4. Faturas/Parcelamentos (installment + recurring) */}
        <Card variant="elevated">
          <CardHeader>
            <div className={cardHeaderRowStyle}>
              <CardDescription>Faturas / Parcelamentos</CardDescription>
              <div className={iconBadgeStyle('expense')}>
                <CreditCard size={18} />
              </div>
            </div>
            <CardTitle className={cardValueStyle('expense')}>
              {formatCurrency(installmentRecurringTotal)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <div className={cardFooterStatsStyle}>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Pago:</span>
                <span className={statValueStyle('income')}>
                  {formatCurrency(installmentRecurringPaid)}
                </span>
              </div>
              <div className={cardFooterRowStyle}>
                <span className={statLabelStyle}>Pendente:</span>
                <span className={statValueStyle('expense')}>
                  {formatCurrency(installmentRecurringPending)}
                </span>
              </div>
            </div>
          </CardFooter>
        </Card>
      </section>

      {/* Conteúdo Principal: Formulário + Lista de Transações */}
      <div className={mainGridStyle}>
        {/* Coluna 1: Formulário Exclusivo de Dívidas / Despesas */}
        <Card variant="elevated">
          <CardHeader>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              {editingTransaction ? (
                <Pencil size={20} className={css({ color: 'brand.600' })} />
              ) : (
                <Plus size={20} className={css({ color: 'brand.600' })} />
              )}
              <CardTitle>
                {editingTransaction ? 'Editar Dívida' : 'Nova Dívida'}
              </CardTitle>
            </div>
            <CardDescription>
              {editingTransaction
                ? 'Atualize os dados e parcelas da despesa selecionada'
                : 'Cadastre despesas fixas, variáveis ou parceladas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm
              fixedType="expense"
              initialData={editingTransaction || undefined}
              onSuccess={() => setEditingTransaction(null)}
              onCancel={() => setEditingTransaction(null)}
            />
          </CardContent>
        </Card>

        {/* Coluna 2: Lista de Transações do Mês */}
        <Card variant="elevated">
          <CardHeader>
            <div className={filterBarContainerStyle}>
              <div>
                <CardTitle>Transações do Mês</CardTitle>
                <CardDescription>
                  Acompanhe e gerencie as contas de {MONTH_NAMES[selectedMonth - 1]}
                </CardDescription>
              </div>

              {/* Filtro por tipo de transação */}
              <div className={filterTabGroupStyle}>
                <Button
                  size="sm"
                  variant={activeTab === 'all' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('all')}
                  className={filterTabButtonStyle}
                >
                  Todas ({transactions.length})
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'expense' ? 'danger' : 'ghost'}
                  onClick={() => setActiveTab('expense')}
                  className={filterTabButtonStyle}
                >
                  Saídas
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'income' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('income')}
                  className={filterTabButtonStyle}
                >
                  Entradas
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading && transactions.length === 0 ? (
              <div className={emptyStateContainerStyle}>
                <p className={emptyStateTextStyle}>Carregando transações...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className={emptyStateContainerStyle}>
                <Layers size={32} className={css({ margin: '0 auto 3', opacity: 0.5 })} />
                <p className={emptyStateTextStyle}>
                  Nenhuma transação cadastrada em {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}.
                </p>
                <span className={emptyStateSubtextStyle}>
                  Utilize o formulário ao lado para cadastrar sua primeira entrada ou dívida.
                </span>
              </div>
            ) : (
              <div className={transactionsListStyle}>
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isPaid = tx.status === 'paid';
                  const txDateClean = tx.date ? tx.date.split('T')[0] : '';
                  // Receitas nunca ficam em atraso; apenas despesas não pagas cujo vencimento já passou
                  const isOverdue = !isIncome && !isPaid && Boolean(txDateClean && txDateClean < todayStr);

                  return (
                    <div
                      key={tx.id}
                      className={transactionItemCardStyle(isPaid, isOverdue)}
                    >
                      {/* Botão Rápido de Quitação (Marcar/Desmarcar como Pago ou Recebido) */}
                      <button
                        type="button"
                        onClick={() => toggleTransactionStatus(tx.id)}
                        className={statusToggleButtonStyle(isPaid)}
                        title={
                          isIncome
                            ? isPaid
                              ? 'Marcar como a receber'
                              : 'Marcar como recebido'
                            : isPaid
                              ? 'Marcar como pendente'
                              : 'Marcar como pago'
                        }
                        aria-label={
                          isIncome
                            ? isPaid
                              ? 'Marcar como a receber'
                              : 'Marcar como recebido'
                            : isPaid
                              ? 'Marcar como pendente'
                              : 'Marcar como pago'
                        }
                      >
                        {isPaid ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>

                      {/* Ícone Indicador de Entrada/Saída */}
                      <div className={transactionTypeIconStyle(isIncome, isPaid)}>
                        {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                      </div>

                      {/* Informações da Transação */}
                      <div className={transactionDetailsStyle}>
                        <div className={transactionTitleRowStyle}>
                          <strong className={transactionTitleStyle(isPaid)}>
                            {tx.description}
                          </strong>

                          {/* Tag de Andamento de Parcelamento */}
                          {tx.category === 'installment' && (
                            <span className={installmentBadgeStyle}>
                              <CreditCard size={12} />
                              Parcela {tx.currentInstallment ?? 1}/{tx.totalInstallments ?? 1}
                            </span>
                          )}

                          {/* Categoria Traduzida */}
                          <span className={categoryBadgeStyle}>
                            {CATEGORY_TRANSLATIONS[tx.category] || tx.category}
                          </span>

                          {/* Badge de Status: Pago / Em Atraso / Pendente para despesas | Recebido / A receber para receitas */}
                          {isPaid ? (
                            <span className={statusBadgePaidStyle}>
                              <Check size={12} />
                              {isIncome ? 'Recebido' : 'Pago'}
                            </span>
                          ) : isOverdue ? (
                            <span className={statusBadgeOverdueStyle}>
                              <AlertTriangle size={12} />
                              Em atraso
                            </span>
                          ) : (
                            <span className={statusBadgePendingStyle}>
                              <Clock size={12} />
                              {isIncome ? 'A receber' : 'Pendente'}
                            </span>
                          )}
                        </div>

                        <div className={transactionMetaRowStyle}>
                          <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '1' })}>
                            <Calendar size={12} />
                            {isIncome ? 'Recebimento' : 'Vencimento'}: {formatDate(tx.date)}
                          </span>
                          {tx.paymentDate && (
                            <span className={css({ color: 'income.600', fontWeight: 'medium' })}>
                              ({isIncome ? 'Recebido' : 'Pago'} em {formatDate(tx.paymentDate)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Área do Valor Monetário e Ações */}
                      <div className={transactionAmountAreaStyle}>
                        <span className={transactionAmountStyle(isIncome, isPaid)}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount || 0)}
                        </span>

                        {/* Botão de Editar: Se for receita, abre modal de receita; se despesa, rola para formulário */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (tx.type === 'income') {
                              setEditingIncome(tx);
                              setIsIncomeModalOpen(true);
                            } else {
                              setEditingTransaction(tx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          aria-label={`Editar ${tx.description}`}
                          className={actionButtonGhostStyle('edit')}
                        >
                          <Pencil size={16} />
                        </Button>

                        {/* Botão de Excluir */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingTransaction(tx)}
                          aria-label={`Excluir ${tx.description}`}
                          className={actionButtonGhostStyle('delete')}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <div className={footerPaginationInfoStyle}>
              <span>
                Exibindo {filteredTransactions.length} de {transactions.length} transações
              </span>
              {isLoading && <span>Atualizando dados...</span>}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Modal Customizado de Confirmação de Exclusão (Substituindo window.confirm) */}
      <Modal
        isOpen={Boolean(deletingTransaction)}
        onClose={() => setDeletingTransaction(null)}
        title="Confirmar Exclusão"
        description="Esta ação removerá o registro financeiro selecionado."
      >
        {deletingTransaction && (
          <div>
            {deletingTransaction.groupId ? (
              /* Caso com groupId (parcelamento ou recorrência com parcelas futuras) */
              <div>
                <div className={modalAlertBoxStyle}>
                  <AlertCircle size={20} className={css({ flexShrink: 0, mt: '0.5', color: 'expense.600' })} />
                  <div>
                    A transação <strong>{deletingTransaction.description}</strong> faz parte de uma
                    série vinculada
                    {deletingTransaction.category === 'installment' && (
                      <span>
                        {' '}
                        (Parcela {deletingTransaction.currentInstallment ?? 1} de{' '}
                        {deletingTransaction.totalInstallments ?? 1})
                      </span>
                    )}
                    .
                    <br />
                    Como você deseja proceder com a exclusão?
                  </div>
                </div>

                <div className={modalGroupSeriesActionsStyle}>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      await deleteTransaction(deletingTransaction.id, true);
                      setDeletingTransaction(null);
                    }}
                    className={css({ width: '100%', justifyContent: 'center' })}
                  >
                    Excluir esta e todas as futuras
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await deleteTransaction(deletingTransaction.id, false);
                      setDeletingTransaction(null);
                    }}
                    className={css({ width: '100%', justifyContent: 'center' })}
                  >
                    Excluir apenas este mês
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeletingTransaction(null)}
                    className={css({ width: '100%', justifyContent: 'center', color: 'slate.600' })}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              /* Caso avulso (sem groupId) */
              <div>
                <div className={modalAlertBoxStyle}>
                  <AlertCircle size={20} className={css({ flexShrink: 0, mt: '0.5', color: 'expense.600' })} />
                  <div>
                    Tem certeza de que deseja excluir permanentemente a transação{' '}
                    <strong>{deletingTransaction.description}</strong> no valor de{' '}
                    <strong>{formatCurrency(deletingTransaction.amount || 0)}</strong>?
                  </div>
                </div>

                <div className={modalButtonGroupStyle}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeletingTransaction(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      await deleteTransaction(deletingTransaction.id, false);
                      setDeletingTransaction(null);
                    }}
                  >
                    Excluir Transação
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Dedicado para Adicionar / Editar Receita */}
      <Modal
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setEditingIncome(null);
        }}
        title={editingIncome ? 'Editar Receita' : 'Nova Receita'}
        description="Cadastre entradas de dinheiro, salários e rendimentos mensais"
      >
        <TransactionForm
          fixedType="income"
          initialData={editingIncome || undefined}
          onSuccess={() => {
            setIsIncomeModalOpen(false);
            setEditingIncome(null);
          }}
          onCancel={() => {
            setIsIncomeModalOpen(false);
            setEditingIncome(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;
