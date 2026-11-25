import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTransactions } from '../contexts/TransactionContext';
import { useProfiles } from '../contexts/ProfileContext';
import { Button, emptyPin, Modal, PinField } from '../components/ui';
import { MonthlySummary, formatCurrency } from '../components/MonthlySummary';
import { NotebookHeader } from '../components/NotebookHeader';
import { ProfileSecurityActions } from '../components/ProfilePin';
import { NotebookViews } from '../components/NotebookViews';
import { TransactionForm } from '../components/TransactionForm';
import { PayslipImportModal } from '../components/PayslipImportModal';
import { formatDate, MONTH_NAMES } from '../calendar';
import type { Transaction } from '@organizador/shared';
import { css } from '@/styled-system/css';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Layers,
  Search,
  ArrowLeftRight,
  Plus,
  Pencil,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
} from 'lucide-react';

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  fixed: 'Fixa',
  recurring: 'Recorrente',
  installment: 'Parcelada',
  daily: 'Cotidiana',
};

function overdueExpense(tx: Transaction, today: string) {
  return tx.type === 'expense' && tx.status !== 'paid' &&
    (tx.status === 'overdue' || Boolean(tx.date && tx.date.split('T')[0] < today));
}

function statementStatus(tx: Transaction, today: string) {
  if (tx.status === 'paid') return 'paid';
  return overdueExpense(tx, today) ? 'overdue' : 'pending';
}

function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

type Editor = { type: Transaction['type']; transaction?: Transaction };
type TypeFilter = 'all' | Transaction['type'];

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
  flexWrap: 'wrap',
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

interface DashboardProps {
  entryNotice: string;
  onProfileSwitch: () => void;
  onProfileDeleted: (name: string) => void;
  onFutureCommitments: () => void;
  transactionTarget: string | null;
  onTransactionLocated: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  entryNotice, onProfileSwitch, onProfileDeleted, onFutureCommitments, transactionTarget, onTransactionLocated,
}) => {
  const { activeProfile, selectProfile, deleteProfile } = useProfiles();
  const {
    transactions,
    isLoading,
    selectedMonth,
    selectedYear,
    setSelectedDate,
    hasMonthData,
    loadError,
    pendingRows,
    fetchTransactions,
    deleteTransaction,
    toggleTransactionStatus,
  } = useTransactions();

  const [activeTab, setActiveTab] = useState<TypeFilter>('all');
  const [situation, setSituation] = useState('all');
  const [search, setSearch] = useState('');
  const [statusErrors, setStatusErrors] = useState(new Map<string, string>());
  const [deleteError, setDeleteError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isDeleteProfileModalOpen, setIsDeleteProfileModalOpen] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [profileDeleteError, setProfileDeleteError] = useState('');
  const [profileDeletePin, setProfileDeletePin] = useState(emptyPin);
  const monthHeading = useRef<HTMLHeadingElement>(null);
  const ledgerHeading = useRef<HTMLHeadingElement>(null);
  const targetRow = useRef<HTMLTableRowElement>(null);
  const restoreLedgerFocus = useRef(false);
  const view = useMemo(() => ({ month: selectedMonth, year: selectedYear }), [selectedMonth, selectedYear]);
  const currentView = useRef<typeof view | null>(null);

  useLayoutEffect(() => {
    currentView.current = view;
    return () => { currentView.current = null; };
  }, [view]);

  useLayoutEffect(() => {
    monthHeading.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!deletingTransaction && !isLoading && restoreLedgerFocus.current) {
      restoreLedgerFocus.current = false;
      if (document.activeElement === document.body) ledgerHeading.current?.focus();
    }
  }, [deletingTransaction, savedNotice, isLoading]);

  useEffect(() => {
    if (entryNotice) setSavedNotice(entryNotice);
  }, [entryNotice]);

  useLayoutEffect(() => {
    if (!transactionTarget || !hasMonthData || isLoading || loadError) return;
    if (targetRow.current) targetRow.current.focus();
    else {
      setSavedNotice('O lançamento selecionado não está mais neste mês.');
      ledgerHeading.current?.focus();
    }
    onTransactionLocated();
  }, [transactionTarget, hasMonthData, isLoading, loadError, onTransactionLocated]);

  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const period = MONTH_NAMES[selectedMonth - 1] + ' de ' + selectedYear;
  const query = searchable(search);
  const visibleTransactions = transactions.filter((tx) => {
    const status = statementStatus(tx, today);
    return (activeTab === 'all' || tx.type === activeTab)
      && (situation === 'all' || situation === status || (situation === 'open' && status !== 'paid'))
      && searchable(tx.description).includes(query);
  }).sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10))
    || a.description.localeCompare(b.description, 'pt-BR') || a.id.localeCompare(b.id));

  function clearFilters() {
    setActiveTab('all');
    setSituation('all');
    setSearch('');
    ledgerHeading.current?.focus();
  }

  async function confirmDeletion(series: boolean) {
    if (!deletingTransaction || isDeletingTransaction) return;
    setIsDeletingTransaction(true);
    setDeleteError('');
    try {
      await deleteTransaction(deletingTransaction.id, series);
      restoreLedgerFocus.current = true;
      setDeletingTransaction(null);
      setSavedNotice(series ? 'Série excluída a partir deste lançamento.' : 'Lançamento excluído: ' + deletingTransaction.description + '.');
    } catch {
      setDeleteError('Falha ao excluir o lançamento. Tente novamente.');
    } finally {
      setIsDeletingTransaction(false);
    }
  }
  const openCount = transactions.filter((tx) => tx.status !== 'paid').length;
  const overdueCount = transactions.filter((tx) => overdueExpense(tx, today)).length;

  function openEditor(event: React.MouseEvent<HTMLButtonElement>, next: Editor) {
    event.currentTarget.focus();
    setSavedNotice('');
    setEditor(next);
  }

  function changeMonth(offset: number) {
    const next = new Date(selectedYear, selectedMonth - 1 + offset, 1);
    if (transactionTarget) onTransactionLocated();
    setStatusErrors(new Map());
    setSavedNotice('');
    setSelectedDate(next.getMonth() + 1, next.getFullYear());
  }

  async function changeStatus(event: React.MouseEvent<HTMLButtonElement>, tx: Transaction) {
    if (pendingRows.has(tx.id)) return;
    const button = event.currentTarget;
    const hadFocus = document.activeElement === button;
    const paid = tx.status === 'paid';
    setStatusErrors((previous) => {
      const next = new Map(previous);
      next.delete(tx.id);
      return next;
    });
    setSavedNotice('');
    try {
      await toggleTransactionStatus(tx.id, paid ? 'pending' : 'paid');
      if (currentView.current !== view) return;
      restoreLedgerFocus.current = hadFocus && !button.isConnected;
      setSavedNotice(tx.description + ': ' + (paid ? 'situação voltou a ficar em aberto' : tx.type === 'income' ? 'marcado como recebido' : 'marcado como pago') + '.');
    } catch {
      if (currentView.current !== view) return;
      setStatusErrors((previous) => new Map(previous).set(
        tx.id, 'Não foi possível alterar a situação de “' + tx.description + '”. Tente novamente.',
      ));
    }
  }

  return (
    <main className="notebook-page dashboard">
      <NotebookHeader>
        {activeProfile && (
          <span className="active-profile">
            <span className="profile-monogram mini" aria-hidden="true">{activeProfile.avatarInitials}</span>
            {activeProfile.name}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          onProfileSwitch();
          selectProfile(null);
        }}><ArrowLeftRight size={14} aria-hidden="true" /> Trocar perfil</Button>
        <ProfileSecurityActions />
        <button type="button" className="profile-delete" onClick={(event) => {
          event.currentTarget.focus();
          setProfileDeleteError('');
          setProfileDeletePin(emptyPin);
          setIsDeleteProfileModalOpen(true);
        }} aria-label={'Excluir perfil ' + activeProfile?.name} title="Excluir perfil ativo"><Trash2 size={15} aria-hidden="true" /></button>
      </NotebookHeader>
      <NotebookViews current="statement" onChange={onFutureCommitments} />

      <header className="month-header">
        <div className="month-nav">
          <h1 ref={monthHeading} tabIndex={-1}><span className="sr-only">Perfil {activeProfile?.name}. </span>{MONTH_NAMES[selectedMonth - 1]} <em>{selectedYear}</em></h1>
          <nav className="month-arrows" aria-label="Navegação mensal">
            <button onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={17} aria-hidden="true" /></button>
            <button onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={17} aria-hidden="true" /></button>
          </nav>
        </div>
        <div className="month-actions">
          <Button onClick={(event) => openEditor(event, { type: 'expense' })}><Plus size={16} aria-hidden="true" /> Nova despesa</Button>
          <Button variant="outline" onClick={(event) => openEditor(event, { type: 'income' })}><Plus size={16} aria-hidden="true" /> Nova receita</Button>
          <Button variant="ghost" onClick={(event) => {
            event.currentTarget.focus();
            setIsPayslipModalOpen(true);
          }}><FileText size={16} aria-hidden="true" /> Importar contracheque</Button>
        </div>
      </header>

      <p role="status" className="transaction-notice">{savedNotice}</p>
      <MonthlySummary transactions={transactions} unavailableReason={loadError ? 'Resumo indisponível.' : hasMonthData ? undefined : 'Aguardando os lançamentos do mês.'} />

      <section className="ledger" aria-labelledby="ledger-title">
        <div className="ledger-heading">
          <div>
            <h2 id="ledger-title" ref={ledgerHeading} tabIndex={-1}>Extrato do mês</h2>
            {hasMonthData && transactions.length > 0 && (
              <p className="attention-summary">
                {openCount ? openCount + ' em aberto' : 'Todos os lançamentos estão realizados'}
                {overdueCount > 0 && <span><AlertTriangle size={14} aria-hidden="true" />{overdueCount} {overdueCount === 1 ? 'despesa em atraso' : 'despesas em atraso'}</span>}
              </p>
            )}
          </div>
        </div>
          <div className="ledger-filters">
            <div className="ledger-tabs" role="group" aria-label="Tipo de lançamento">
              {([['all', 'Todos'], ['expense', 'Despesas'], ['income', 'Receitas']] as const).map(([type, label]) => (
                <button key={type} aria-pressed={activeTab === type} onClick={() => setActiveTab(type)}>{label}</button>
              ))}
            </div>
            <label className="ledger-search"><Search size={16} aria-hidden="true" />
              <input type="search" aria-label="Buscar por descrição no mês" placeholder="Buscar por descrição no mês"
                value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="ledger-situation">Situação
              <select value={situation} onChange={(event) => setSituation(event.target.value)}>
                <option value="all">Todas</option>
                <option value="open">Em aberto</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Vencido</option>
                <option value="paid">Pago ou recebido</option>
              </select>
            </label>
          </div>

        {Array.from(statusErrors, ([id, message]) => <p key={id} role="alert" className="transaction-error">{message}</p>)}
        {loadError && (
          <div className={transactions.length ? undefined : 'ledger-empty'}>
            <p role="alert" className="transaction-error">
              {loadError}{transactions.length > 0 && ' Mostrando os últimos dados carregados.'}
            </p>
            <Button variant="outline" size="sm" aria-disabled={isLoading || undefined} onClick={async (event) => {
              if (isLoading) return;
              restoreLedgerFocus.current = document.activeElement === event.currentTarget;
              await fetchTransactions();
            }}>Tentar carregar {period} novamente</Button>
          </div>
        )}
        {!hasMonthData && !loadError && (
          <div className="ledger-empty">Carregando lançamentos de {period}…</div>
        )}
        {hasMonthData && (!loadError || transactions.length > 0) && (visibleTransactions.length === 0 ? (
          <div className="ledger-empty">
            <Layers size={26} strokeWidth={1.5} aria-hidden="true" />
            <p className="empty-title">{transactions.length ? 'Nenhum lançamento com estes filtros.' : 'Nenhum lançamento em ' + period + '.'}</p>
            {transactions.length ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
            ) : <div className="ledger-empty-actions">
              <Button variant="outline" size="sm" onClick={(event) => openEditor(event, { type: 'expense' })}>Nova despesa</Button>
              <Button variant="outline" size="sm" onClick={(event) => openEditor(event, { type: 'income' })}>Nova receita</Button>
            </div>}
          </div>
        ) : (
          <table className="ledger-table" role="table" aria-label={'Lançamentos de ' + period}>
            <thead role="rowgroup"><tr role="row">
              <th role="columnheader" scope="col">Descrição</th><th role="columnheader" scope="col">Data prevista</th><th role="columnheader" scope="col">Situação</th>
              <th role="columnheader" scope="col" className="amount-heading">Valor</th><th role="columnheader" scope="col" className="actions-heading">Ações</th>
            </tr></thead>
            <tbody role="rowgroup">{visibleTransactions.map((tx) => {
              const paid = tx.status === 'paid';
              const income = tx.type === 'income';
              const overdue = overdueExpense(tx, today);
              const status = paid ? (income ? 'Recebido' : 'Pago') : overdue ? 'Vencido' : 'Pendente';
              const action = paid ? (income ? 'Marcar como a receber' : 'Marcar como pendente') : income ? 'Marcar como recebido' : 'Marcar como pago';
              const StatusIcon = paid ? CheckCircle2 : overdue ? AlertCircle : Clock;
              const operation = pendingRows.get(tx.id);

              return (
                <tr key={tx.id} className="ledger-row" role="row" tabIndex={-1}
                  ref={tx.id === transactionTarget ? targetRow : undefined}>
                  <th role="rowheader" scope="row" className="tx-description">
                    <strong>{tx.description}</strong>
                    <small>{income ? 'Receita' : 'Despesa'} · {CATEGORY_TRANSLATIONS[tx.category] || tx.category}
                      {tx.currentInstallment != null && tx.totalInstallments != null && <span> · Parcela {tx.currentInstallment}/{tx.totalInstallments}</span>}
                    </small>
                  </th>
                  <td role="cell" className="tx-date"><span>{formatDate(tx.date)}</span>
                    {tx.paymentDate && <small>{income ? 'Recebido' : 'Pago'} em {formatDate(tx.paymentDate)}</small>}
                  </td>
                  <td role="cell" className="tx-state">
                    <button className={'settle-button ' + (paid ? 'paid' : overdue ? 'overdue' : '')}
                      title={action} aria-label={status + ' — ' + action + ' — ' + tx.description}
                      aria-busy={operation === 'status' || undefined} aria-disabled={Boolean(operation) || undefined}
                      onClick={(event) => void changeStatus(event, tx)}>
                      <StatusIcon size={15} aria-hidden="true" />{operation === 'status' ? 'Alterando…' : status}
                    </button>
                  </td>
                  <td role="cell" className={income ? 'tx-amount income' : 'tx-amount'}>{income ? '+' : '−'} {formatCurrency(tx.amount || 0)}</td>
                  <td role="cell" className="tx-actions">
                    <Button size="sm" variant="ghost" aria-label={'Editar ' + tx.description} title="Editar lançamento"
                      disabled={Boolean(operation)} onClick={(event) => openEditor(event, { type: tx.type, transaction: tx })}><Pencil size={15} aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" aria-label={'Excluir ' + tx.description} title="Excluir lançamento"
                      disabled={Boolean(operation)}
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setSavedNotice('');
                        setDeleteError('');
                        setDeletingTransaction(tx);
                      }}><Trash2 size={15} aria-hidden="true" /></Button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        ))}
        <p className={hasMonthData && transactions.length && !loadError ? 'ledger-count' : 'sr-only'} role="status">
          {isLoading ? (
            hasMonthData ? 'Atualizando lançamentos de ' + period + '.' : 'Carregando lançamentos de ' + period + '.'
          ) : hasMonthData && !loadError ? (
            transactions.length
              ? visibleTransactions.length + ' de ' + transactions.length + ' lançamentos em ' + period + (visibleTransactions.length ? '.' : '. Nenhum lançamento com estes filtros.')
              : 'Nenhum lançamento em ' + period + '.'
          ) : ''}
        </p>
      </section>

      {/* Modal Customizado de Confirmação de Exclusão (Substituindo window.confirm) */}
      <Modal
        isOpen={Boolean(deletingTransaction)}
        onClose={() => setDeletingTransaction(null)}
        dismissDisabled={isDeletingTransaction}
        title="Excluir lançamento?"
        description="Esta ação removerá o registro financeiro selecionado."
      >
        <p role="alert" className="transaction-error">{deleteError}</p>
        <p role="status">{isDeletingTransaction ? 'Excluindo o lançamento…' : ''}</p>
        {deletingTransaction && (
          <div>
            {deletingTransaction.groupId ? (
              /* Caso com groupId (parcelamento ou recorrência com parcelas futuras) */
              <div>
                <div className={modalAlertBoxStyle}>
                  <AlertCircle size={20} className={css({ flexShrink: 0, mt: '0.5', color: 'expense.600' })} />
                  <div>
                    Ao excluir a série de <strong>{deletingTransaction.description}</strong>,
                    serão removidos este lançamento e os vinculados à mesma série
                    {deletingTransaction.currentInstallment != null
                      ? ' a partir da parcela ' + deletingTransaction.currentInstallment
                      : ' com data igual ou posterior a ' + formatDate(deletingTransaction.date)}.
                  </div>
                </div>

                <div className={modalGroupSeriesActionsStyle}>
                  <Button
                    type="button"
                    variant="danger"
                    aria-disabled={isDeletingTransaction || undefined}
                    onClick={() => void confirmDeletion(true)}
                    className={css({ width: '100%', justifyContent: 'center' })}
                  >
                    Excluir esta e todas as futuras
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-disabled={isDeletingTransaction || undefined}
                    onClick={() => void confirmDeletion(false)}
                    className={css({ width: '100%', justifyContent: 'center' })}
                  >
                    Excluir só este lançamento
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    data-initial-focus
                    disabled={isDeletingTransaction}
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
                    data-initial-focus
                    disabled={isDeletingTransaction}
                    onClick={() => setDeletingTransaction(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    aria-disabled={isDeletingTransaction || undefined}
                    onClick={() => void confirmDeletion(false)}
                  >
                    Excluir Transação
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {editor && (
        <Modal isOpen onClose={() => setEditor(null)} dismissDisabled={isSavingTransaction}
          title={(editor.transaction ? 'Editar ' : 'Nova ') + (editor.type === 'income' ? 'receita' : 'despesa')}
          description={activeProfile?.name + ' · ' + period}>
          <TransactionForm fixedType={editor.type} initialData={editor.transaction} onSavingChange={setIsSavingTransaction}
            onSuccess={() => {
              restoreLedgerFocus.current = true;
              setSavedNotice(editor.transaction ? 'Alterações salvas neste lançamento.' : editor.type === 'income' ? 'Receita cadastrada.' : 'Despesa cadastrada.');
              setEditor(null);
            }} onCancel={() => setEditor(null)} />
        </Modal>
      )}

      {/* Modal de Importação de Contracheque em PDF */}
      <PayslipImportModal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
      />

      {/* Modal de Confirmação para Excluir Perfil Ativo */}
      <Modal
        isOpen={isDeleteProfileModalOpen}
        onClose={() => setIsDeleteProfileModalOpen(false)}
        dismissDisabled={isDeletingProfile}
        title="Excluir Perfil"
        description="Esta ação é permanente e não poderá ser desfeita"
      >
        {activeProfile && (
          <form className={css({ display: 'flex', flexDirection: 'column', gap: '4' })} onSubmit={async event => {
            event.preventDefault();
            if (isDeletingProfile) return;
            setIsDeletingProfile(true);
            setProfileDeleteError('');
            try {
              await deleteProfile(activeProfile.id, activeProfile.hasPin ? profileDeletePin.join('') : undefined);
              onProfileDeleted(activeProfile.name);
            } catch (err) {
              setProfileDeleteError(err instanceof Error ? err.message : 'Falha ao excluir o perfil. Tente novamente.');
            } finally {
              setIsDeletingProfile(false);
            }
          }}>
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

            {activeProfile.hasPin && <PinField label="PIN atual" value={profileDeletePin} disabled={isDeletingProfile}
              aria-invalid={Boolean(profileDeleteError)} aria-describedby="profile-delete-error"
              onValueChange={value => { setProfileDeletePin(value); setProfileDeleteError(''); }} />}
            <p id="profile-delete-error" role="alert" className="transaction-error">{profileDeleteError}</p>
            <p role="status">{isDeletingProfile ? 'Excluindo o perfil…' : ''}</p>
            <div className={css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '3', marginTop: '2' })}>
              <Button
                type="button"
                variant="ghost"
                data-initial-focus
                onClick={() => setIsDeleteProfileModalOpen(false)}
                disabled={isDeletingProfile}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                aria-disabled={isDeletingProfile || undefined}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                })}
              >
                <Trash2 size={16} aria-hidden="true" />
                <span>Sim, excluir perfil</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
};

export default Dashboard;
