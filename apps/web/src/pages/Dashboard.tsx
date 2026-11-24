import React, { useState } from 'react';
import { useTransactions } from '../contexts/TransactionContext';
import { useProfiles } from '../contexts/ProfileContext';
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
import { NotebookHeader } from '../components/NotebookHeader';
import { TransactionForm } from '../components/TransactionForm';
import { PayslipImportModal } from '../components/PayslipImportModal';
import type { Transaction } from '@organizador/shared';
import { css } from '@/styled-system/css';
import {
  Wallet,
  NotebookPen,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  Layers,
  ArrowLeftRight,
  Plus,
  Pencil,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
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
  const { activeProfile, selectProfile, deleteProfile } = useProfiles();
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
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isDeleteProfileModalOpen, setIsDeleteProfileModalOpen] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

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

  const metrics: { title: string; icon: typeof Wallet; value: number; rows: [string, number][] }[] = [
    { title: 'Saldo livre', icon: Wallet, value: freeBalance, rows: [['Realizado', realizedBalance], ['Pendente previsto', pendingBalance]] },
    { title: 'Total de entradas', icon: TrendingUp, value: totalIncome, rows: [['Recebido', paidIncome], ['A receber', pendingIncome]] },
    { title: 'Despesas do dia a dia', icon: ShoppingBag, value: dailyFixedTotal, rows: [['Pago', dailyFixedPaid], ['Pendente', dailyFixedPending]] },
    { title: 'Faturas e parcelas', icon: CreditCard, value: installmentRecurringTotal, rows: [['Pago', installmentRecurringPaid], ['Pendente', installmentRecurringPending]] },
  ];

  return (
    <main className="notebook-page">
      <NotebookHeader>
        {activeProfile && (
          <span className="active-profile">
            <span className="profile-monogram mini" aria-hidden="true">{activeProfile.avatarInitials}</span>
            {activeProfile.name}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => selectProfile(null)}><ArrowLeftRight size={14} /> Trocar perfil</Button>
        <button className="profile-delete" onClick={() => setIsDeleteProfileModalOpen(true)} aria-label="Excluir perfil ativo" title="Excluir perfil ativo"><Trash2 size={15} /></button>
      </NotebookHeader>

      <header className="month-header">
        <div>
          <div className="small-label"><NotebookPen size={15} /> Caderno financeiro</div>
          <div className="month-nav">
            <h1>{MONTH_NAMES[selectedMonth - 1]} <em>{selectedYear}</em></h1>
            <div className="month-arrows">
              <button onClick={handlePrevMonth} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
              <button onClick={handleNextMonth} aria-label="Próximo mês"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
        <div className="month-actions">
          <Button variant="outline" onClick={() => setIsPayslipModalOpen(true)}><FileText size={16} /> Importar contracheque</Button>
          <Button onClick={() => { setEditingIncome(null); setIsIncomeModalOpen(true); }}><Plus size={16} /> Nova receita</Button>
        </div>
      </header>

      <section className="month-summary" aria-label="Resumo financeiro">
        {metrics.map(({ title, icon: Icon, value, rows }) => (
          <div className="metric" key={title}>
            <h2><Icon size={17} strokeWidth={1.6} /> {title}</h2>
            <p className="metric-value">{formatCurrency(value)}</p>
            <dl>{rows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatCurrency(amount)}</dd></div>)}</dl>
          </div>
        ))}
      </section>

      <div className="ledger-layout">
        {/* Coluna 1: Formulário Exclusivo de Dívidas / Despesas */}
        <Card variant="outline" className="entry-form" id="debt-form">
          <CardHeader>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              {editingTransaction ? (
                <Pencil size={20} className={css({ color: 'brand.600' })} />
              ) : (
                <Plus size={20} className={css({ color: 'brand.600' })} />
              )}
              <CardTitle>
                {editingTransaction ? 'Editar dívida' : 'Nova dívida'}
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

        {/* Coluna 2: Lista de Transações do mês */}
        <Card variant="outline" className="ledger">
          <CardHeader>
            <div className="ledger-header">
              <div>
                <CardTitle>Transações do mês</CardTitle>
                <CardDescription>
                  Acompanhe e gerencie as contas de {MONTH_NAMES[selectedMonth - 1]}
                </CardDescription>
              </div>

              {/* Filtro por tipo de transação */}
              <div className="ledger-tabs">
                <Button
                  size="sm"
                  variant={activeTab === 'all' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('all')}
                  aria-pressed={activeTab === 'all'}
                >
                  Todas ({transactions.length})
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'expense' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('expense')}
                  aria-pressed={activeTab === 'expense'}
                >
                  Saídas
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'income' ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab('income')}
                  aria-pressed={activeTab === 'income'}
                >
                  Entradas
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading && transactions.length === 0 ? (
              <div className="ledger-empty">
                <p className="empty-title">Carregando transações...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="ledger-empty">
                <Layers size={32} className={css({ margin: '0 auto 3', opacity: 0.5 })} />
                <p className="empty-title">
                  Nenhuma transação nesta seleção em {MONTH_NAMES[selectedMonth - 1]} de {selectedYear}.
                </p>
                <span className="empty-hint">
                  Use Nova receita ou o formulário de dívida para registrar uma transação.
                </span>
              </div>
            ) : (
              <div className="ledger-list">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isPaid = tx.status === 'paid';
                  const txDateClean = tx.date ? tx.date.split('T')[0] : '';
                  // Receitas nunca ficam em atraso; apenas despesas não pagas cujo vencimento já passou
                  const isOverdue = !isIncome && !isPaid && Boolean(txDateClean && txDateClean < todayStr);

                  return (
                    <div
                      key={tx.id}
                      className="ledger-row"
                    >
                      {/* Botão Rápido de Quitação (Marcar/Desmarcar como Pago ou Recebido) */}
                      <button
                        type="button"
                        onClick={() => toggleTransactionStatus(tx.id)}
                        className="settle-button"
                        aria-pressed={isPaid}
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

                      {/* Informações da Transação */}
                      <div className="tx-details">
                        <div className="tx-title">
                          <strong className="tx-name">
                            {tx.description}
                          </strong>

                          {/* Tag de Andamento de Parcelamento */}
                          {tx.category === 'installment' && (
                            <span className="tx-category">
                              <CreditCard size={12} />
                              Parcela {tx.currentInstallment ?? 1}/{tx.totalInstallments ?? 1}
                            </span>
                          )}

                          {/* Categoria Traduzida */}
                          <span className="tx-category">
                            {CATEGORY_TRANSLATIONS[tx.category] || tx.category}
                          </span>

                          {/* Badge de Status: Pago / Em Atraso / Pendente para despesas | Recebido / A receber para receitas */}
                          {isPaid ? (
                            <span className="tx-status paid">
                              <Check size={12} />
                              {isIncome ? 'Recebido' : 'Pago'}
                            </span>
                          ) : isOverdue ? (
                            <span className="tx-status overdue">
                              <AlertTriangle size={12} />
                              Em atraso
                            </span>
                          ) : (
                            <span className="tx-status">
                              <Clock size={12} />
                              {isIncome ? 'A receber' : 'Pendente'}
                            </span>
                          )}
                        </div>

                        <div className="tx-meta">
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
                      <div className="tx-amount-actions">
                        <span className={isIncome ? "tx-amount income" : "tx-amount"}>
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
                              document.getElementById('debt-form')?.scrollIntoView({ block: 'start' });
                            }
                          }}
                          aria-label={`Editar ${tx.description}`}
                          className="tx-action edit"
                        >
                          <Pencil size={18} />
                        </Button>

                        {/* Botão de Excluir */}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingTransaction(tx)}
                          aria-label={`Excluir ${tx.description}`}
                          className="tx-action delete"
                        >
                          <Trash2 size={18} />
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

      {/* Modal de Importação de Contracheque em PDF */}
      <PayslipImportModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
      />

      {/* Modal de Confirmação para Excluir Perfil Ativo */}
      <Modal
        isOpen={isDeleteProfileModalOpen}
        onClose={() => !isDeletingProfile && setIsDeleteProfileModalOpen(false)}
        title="Excluir Perfil"
        description="Esta ação é permanente e não poderá ser desfeita"
      >
        {activeProfile && (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '3',
                padding: '3.5',
                borderRadius: 'xl',
                backgroundColor: 'expense.50',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'expense.200',
                color: 'expense.800',
                fontSize: 'sm',
              })}
            >
              <AlertTriangle size={24} className={css({ flexShrink: 0, color: 'expense.600' })} />
              <div>
                Tem certeza de que deseja excluir permanentemente o perfil <strong>{activeProfile.name}</strong>?
                <div className={css({ fontSize: 'xs', color: 'expense.700', marginTop: '1' })}>
                  Todas as receitas, despesas, parcelamentos e dados deste perfil serão excluídos.
                </div>
              </div>
            </div>

            <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '3', marginTop: '2' })}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleteProfileModalOpen(false)}
                disabled={isDeletingProfile}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isDeletingProfile}
                onClick={async () => {
                  setIsDeletingProfile(true);
                  try {
                    await deleteProfile(activeProfile.id);
                    setIsDeleteProfileModalOpen(false);
                  } catch (err) {
                    console.error('Erro ao excluir perfil ativo:', err);
                  } finally {
                    setIsDeletingProfile(false);
                  }
                }}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                })}
              >
                <Trash2 size={16} />
                <span>{isDeletingProfile ? 'Excluindo...' : 'Sim, Excluir Perfil'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
};

export default Dashboard;
