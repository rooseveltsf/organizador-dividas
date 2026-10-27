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

// Estilos utilizando Panda CSS
const pageContainerStyle = css({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: { base: '4', md: '8' },
  minHeight: '100vh',
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

const incomeAmountStyle = css({
  color: 'income.600',
  fontWeight: 'bold',
  fontSize: 'md',
});

const expenseAmountStyle = css({
  color: 'expense.600',
  fontWeight: 'bold',
  fontSize: 'md',
});

const installmentBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  backgroundColor: 'brand.50',
  color: 'brand.700',
  borderWidth: '1px',
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
  textTransform: 'capitalize',
});

const transactionCardStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderColor: 'slate.200',
  backgroundColor: 'white',
  transition: 'all 0.2s ease-in-out',
  gap: '3',
  _hover: {
    borderColor: 'slate.300',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  },
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
  } = useTransactions();

  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all');

  // ==========================================================================
  // Processamento com reduce dos 4 cards de métricas
  // ==========================================================================

  // 1. Total de Entradas
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  // Total de Saídas
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  // 2. Saldo Livre (Entradas - Saídas)
  const freeBalance = totalIncome - totalExpense;

  // 3. Despesas do dia a dia (daily + fixed)
  const dailyFixedExpenses = transactions
    .filter(
      (t) =>
        t.type === 'expense' && (t.category === 'daily' || t.category === 'fixed')
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  // 4. Faturas/Parcelamentos (installment + recurring)
  const installmentRecurringExpenses = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        (t.category === 'installment' || t.category === 'recurring')
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0);

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

  // Exclusão de transação (com suporte a parcelamento em lote)
  const handleDelete = async (tx: Transaction) => {
    if (tx.category === 'installment' && tx.groupId) {
      const confirmAll = window.confirm(
        `Esta transação faz parte de um parcelamento (${tx.description}).\n\n` +
          `Deseja excluir TODAS as parcelas restantes a partir desta?\n` +
          `- Clique em 'OK' para excluir todas as parcelas futuras.\n` +
          `- Clique em 'Cancelar' para excluir APENAS esta parcela do mês atual.`
      );
      await deleteTransaction(tx.id, confirmAll);
    } else {
      if (window.confirm(`Deseja realmente excluir "${tx.description}"?`)) {
        await deleteTransaction(tx.id);
      }
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
      <header
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            Organizador de Dívidas
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Painel financeiro mensal e controle de parcelamentos
          </p>
        </div>

        {/* Seletor de Mês/Ano */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'white',
            padding: '0.375rem 0.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronLeft size={16} />
          </Button>

          <span
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#1e293b',
              minWidth: '150px',
              textAlign: 'center',
            }}
          >
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </header>

      {/* 4 Cards de Métricas Principais (com reduce) */}
      <section className={cardsGridStyle} aria-label="Resumo Financeiro">
        {/* 1. Saldo Livre */}
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <CardDescription>Saldo Livre</CardDescription>
              <div
                style={{
                  backgroundColor: freeBalance >= 0 ? '#ecfdf5' : '#fef2f2',
                  color: freeBalance >= 0 ? '#059669' : '#dc2626',
                  padding: '0.375rem',
                  borderRadius: '0.5rem',
                }}
              >
                <Wallet size={18} />
              </div>
            </div>
            <CardTitle
              style={{
                color: freeBalance >= 0 ? '#10b981' : '#ef4444',
                fontSize: '1.625rem',
                marginTop: '0.5rem',
              }}
            >
              {formatCurrency(freeBalance)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Entradas menos despesas no mês
            </span>
          </CardFooter>
        </Card>

        {/* 2. Total de Entradas */}
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <CardDescription>Total de Entradas</CardDescription>
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  padding: '0.375rem',
                  borderRadius: '0.5rem',
                }}
              >
                <TrendingUp size={18} />
              </div>
            </div>
            <CardTitle
              style={{
                color: '#10b981',
                fontSize: '1.625rem',
                marginTop: '0.5rem',
              }}
            >
              {formatCurrency(totalIncome)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Salários e receitas fixas/extras
            </span>
          </CardFooter>
        </Card>

        {/* 3. Despesas do dia a dia (daily + fixed) */}
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <CardDescription>Despesas do Dia a Dia</CardDescription>
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.375rem',
                  borderRadius: '0.5rem',
                }}
              >
                <ShoppingBag size={18} />
              </div>
            </div>
            <CardTitle
              style={{
                color: '#334155',
                fontSize: '1.625rem',
                marginTop: '0.5rem',
              }}
            >
              {formatCurrency(dailyFixedExpenses)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Contas fixas e despesas diárias
            </span>
          </CardFooter>
        </Card>

        {/* 4. Faturas/Parcelamentos (installment + recurring) */}
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <CardDescription>Faturas / Parcelamentos</CardDescription>
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '0.375rem',
                  borderRadius: '0.5rem',
                }}
              >
                <CreditCard size={18} />
              </div>
            </div>
            <CardTitle
              style={{
                color: '#ef4444',
                fontSize: '1.625rem',
                marginTop: '0.5rem',
              }}
            >
              {formatCurrency(installmentRecurringExpenses)}
            </CardTitle>
          </CardHeader>
          <CardFooter>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Cartões, parcelas e assinaturas
            </span>
          </CardFooter>
        </Card>
      </section>

      {/* Conteúdo Principal: Formulário + Lista de Transações */}
      <div className={mainGridStyle}>
        {/* Coluna 1: Formulário de Nova Transação */}
        <Card variant="elevated">
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="#4f46e5" />
              <CardTitle>Nova Transação</CardTitle>
            </div>
            <CardDescription>Cadastre entradas ou despesas parceladas</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm />
          </CardContent>
        </Card>

        {/* Coluna 2: Lista de Transações do Mês */}
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <CardTitle>Transações do Mês</CardTitle>
                <CardDescription>
                  Acompanhe e gerencie as contas de {MONTH_NAMES[selectedMonth - 1]}
                </CardDescription>
              </div>

              {/* Filtro por tipo de transação */}
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
                <Button
                  size="sm"
                  variant={activeTab === 'all' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('all')}
                  style={{ height: '1.75rem', fontSize: '0.75rem', padding: '0 0.5rem' }}
                >
                  Todas ({transactions.length})
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'expense' ? 'danger' : 'ghost'}
                  onClick={() => setActiveTab('expense')}
                  style={{ height: '1.75rem', fontSize: '0.75rem', padding: '0 0.5rem' }}
                >
                  Saídas
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'income' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('income')}
                  style={{ height: '1.75rem', fontSize: '0.75rem', padding: '0 0.5rem' }}
                >
                  Entradas
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading && transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <p>Carregando transações...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: '#94a3b8',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.75rem',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <Layers size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ fontWeight: 500, color: '#64748b', margin: 0 }}>
                  Nenhuma transação cadastrada em {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}.
                </p>
                <span style={{ fontSize: '0.8125rem' }}>
                  Utilize o formulário ao lado para cadastrar sua primeira entrada ou dívida.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';

                  return (
                    <div key={tx.id} className={transactionCardStyle}>
                      {/* Ícone de status/tipo */}
                      <div
                        style={{
                          backgroundColor: isIncome ? '#ecfdf5' : '#fef2f2',
                          color: isIncome ? '#059669' : '#dc2626',
                          padding: '0.5rem',
                          borderRadius: '0.625rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                      </div>

                      {/* Informações da Transação */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <strong
                            style={{
                              color: '#0f172a',
                              fontSize: '0.9375rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {tx.description}
                          </strong>

                          {/* Tag visual de andamento da dívida para parcelamento */}
                          {tx.category === 'installment' && (
                            <span className={installmentBadgeStyle}>
                              <CreditCard size={12} />
                              Parcela {tx.currentInstallment ?? 1}/{tx.totalInstallments ?? 1}
                            </span>
                          )}

                          <span className={categoryBadgeStyle}>
                            {tx.category === 'installment' ? 'parcelada' : tx.category}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginTop: '0.25rem',
                          }}
                        >
                          <Calendar size={12} />
                          <span>Vencimento: {formatDate(tx.date)}</span>
                        </div>
                      </div>

                      {/* Valor monetário formatado com Panda CSS */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          textAlign: 'right',
                        }}
                      >
                        <span className={isIncome ? incomeAmountStyle : expenseAmountStyle}>
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount || 0)}
                        </span>

                        {/* Botão de Excluir */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(tx)}
                          aria-label={`Excluir ${tx.description}`}
                          style={{
                            color: '#94a3b8',
                            padding: '0.25rem 0.5rem',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                          }}
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
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#94a3b8',
              }}
            >
              <span>Exibindo {filteredTransactions.length} de {transactions.length} transações</span>
              {isLoading && <span>Atualizando dados...</span>}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
