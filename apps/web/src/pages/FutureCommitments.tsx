import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import type { Transaction } from '@organizador/shared';
import { firstFutureMonth, formatDate, monthLabel, shiftMonth } from '../calendar';
import { formatCurrency, formatCurrencyCents } from '../components/MonthlySummary';
import { NotebookHeader } from '../components/NotebookHeader';
import { ProfileSecurityActions } from '../components/ProfilePin';
import { NotebookViews } from '../components/NotebookViews';
import { Button, Select } from '../components/ui';
import { useProfiles, useTransactions } from '../contexts';
import { COMMITMENT_CATEGORIES, summarizeCommitments, type CommitmentCategory } from '../futureCommitments';

const labels: Record<CommitmentCategory, { singular: string; plural: string }> = {
  fixed: { singular: 'Fixa', plural: 'Fixas' },
  recurring: { singular: 'Recorrente', plural: 'Recorrentes' },
  installment: { singular: 'Parcelada', plural: 'Parceladas' },
};

const loadError = 'Não foi possível carregar os compromissos deste perfil.';
function installmentLabel(tx: Transaction) {
  const { currentInstallment: current, totalInstallments: total } = tx;
  return current != null && total != null && current >= 1 && current <= total
    ? `Parcela ${current} de ${total}` : 'Numeração da parcela indisponível';
}

type FutureCommitmentsProps = {
  month: string;
  onMonthChange: (month: string) => void;
  onStatement: () => void;
  onOpenTransaction: (tx: Transaction) => void;
};

export function FutureCommitments({ onStatement, ...monthProps }: FutureCommitmentsProps) {
  const { activeProfile, profiles, selectProfile } = useProfiles();
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => { heading.current?.focus(); }, []);

  if (!activeProfile) return null;
  return (
    <main className="notebook-page dashboard commitments-page">
      <NotebookHeader>
        <span className="profile-monogram mini" aria-hidden="true">{activeProfile.avatarInitials}</span>
        <div className="commitments-profile">
          <Select aria-label="Perfil" size="lg" value={activeProfile.id} onChange={(event) => {
            const profile = profiles.find((item) => item.id === event.target.value);
            if (profile) selectProfile(profile);
          }}>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </Select>
        </div>
        <ProfileSecurityActions />
      </NotebookHeader>
      <NotebookViews current="future" onChange={onStatement} />

      <header className="commitments-heading">
        <h1 ref={heading} tabIndex={-1}>Compromissos futuros</h1>
        <p>Despesas fixas, recorrentes e parceladas cadastradas para cada mês futuro.</p>
      </header>

      <FutureMonth key={activeProfile.id} profileId={activeProfile.id} {...monthProps} />
    </main>
  );
}

function FutureMonth({ profileId, month, onMonthChange, onOpenTransaction }:
  Omit<FutureCommitmentsProps, 'onStatement'> & { profileId: string }) {
  const firstMonth = firstFutureMonth();
  const selectedMonth = month < firstMonth ? firstMonth : month;
  const { pendingRows } = useTransactions();
  const { requestProfileApi } = useProfiles();
  const hasPendingWrites = pendingRows.size > 0;
  const [result, setResult] = useState<{ rows: Transaction[] } | { error: true } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const periodHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setResult(null);
    if (hasPendingWrites) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ profileId, type: 'expense', startDate: firstMonth + '-01' });
    async function load() {
      try {
        const rows = await requestProfileApi<Transaction[]>('/transactions?' + query, loadError, { signal: controller.signal });
        if (!Array.isArray(rows)) throw new Error(loadError);
        if (!controller.signal.aborted) setResult({ rows });
      } catch {
        if (!controller.signal.aborted) setResult({ error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [profileId, firstMonth, hasPendingWrites, attempt, requestProfileApi]);

  const summary = useMemo(() => result && 'rows' in result
    ? summarizeCommitments(result.rows, profileId, selectedMonth) : null, [result, profileId, selectedMonth]);
  const nextMonth = summary?.nextMonth;
  const period = monthLabel(selectedMonth);
  const atStart = selectedMonth === firstMonth;
  const atEnd = selectedMonth === '9999-12';

  return (
    <section aria-labelledby="commitments-period">
      <header className="commitments-period">
        <h2 id="commitments-period" ref={periodHeading} tabIndex={-1} aria-live="polite">{period}</h2>
        <nav className="month-arrows" aria-label="Navegação dos compromissos por mês">
          <button type="button" aria-label="Mês anterior" aria-disabled={atStart || undefined}
            onClick={() => { if (!atStart) onMonthChange(shiftMonth(selectedMonth, -1)); }}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Próximo mês" aria-disabled={atEnd || undefined}
            onClick={() => { if (!atEnd) onMonthChange(shiftMonth(selectedMonth, 1)); }}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      </header>

      {!result && <div className="commitments-empty" role="status">Carregando compromissos…</div>}
      {result && 'error' in result && (
        <div className="commitments-empty">
          <p className="transaction-error" role="alert">{loadError}</p>
          <Button variant="outline" onClick={() => {
            periodHeading.current?.focus();
            setResult(null);
            setAttempt((previous) => previous + 1);
          }}>Tentar novamente</Button>
        </div>
      )}
      {summary && (summary.commitments.length ? (
        <>
          <section className="commitments-summary" aria-label={'Resumo de ' + period}>
            <div className="commitments-total">
              <h3>Em aberto no mês</h3>
              <p className="commitments-total-value">{formatCurrencyCents(summary.plannedCents - summary.paidCents)}</p>
              <dl>
                <div><dt>Total previsto no mês</dt><dd>{formatCurrencyCents(summary.plannedCents)}</dd></div>
                <div><dt>Já pago</dt><dd>{formatCurrencyCents(summary.paidCents)}</dd></div>
              </dl>
            </div>
            <div className="commitments-categories">
              <h3>Em aberto por categoria</h3>
              <dl>{COMMITMENT_CATEGORIES.map((category) => (
                <div key={category}>
                  <dt><span className={'commitment-category ' + category}>{labels[category].plural}</span></dt>
                  <dd>{formatCurrencyCents(summary.openByCategory[category])}</dd>
                </div>
              ))}</dl>
            </div>
          </section>

          <section className="commitments-ledger" aria-labelledby="commitments-list-title">
            <h3 id="commitments-list-title">Lançamentos previstos</h3>
            <ul className="commitments-list">
              {summary.commitments.map((tx) => {
                const paid = tx.status === 'paid';
                const overdue = tx.status === 'overdue';
                const installment = tx.category === 'installment';
                const remainder = tx.groupId ? summary.laterBySeries.get(tx.groupId) : undefined;
                return (
                  <li className="commitment-row" key={tx.id}>
                    <div className="commitment-description">
                      <h4>{tx.description}</h4>
                      <div className="commitment-tags">
                        <span className={'commitment-category ' + tx.category}>{labels[tx.category].singular}</span>
                        {installment && <span>{installmentLabel(tx)}</span>}
                      </div>
                      {installment && (
                        <p className="commitment-remainder">{!tx.groupId ? 'Sem vínculo com uma série' : remainder ? (
                          <>{remainder.count} {remainder.count === 1 ? 'parcela cadastrada' : 'parcelas cadastradas'} em aberto após este mês <span>· {formatCurrencyCents(remainder.cents)}</span></>
                        ) : 'Nenhuma parcela cadastrada em aberto após este mês'}</p>
                      )}
                    </div>
                    <p className="commitment-date">
                      <span>Vencimento</span><time dateTime={tx.date.slice(0, 10)}>{formatDate(tx.date)}</time>
                    </p>
                    <p className="commitment-amount">
                      <strong>{formatCurrency(tx.amount)}</strong>
                      <span className={paid ? 'paid' : overdue ? 'overdue' : undefined}>{paid ? 'Paga' : overdue ? 'Vencida' : 'Em aberto'}</span>
                    </p>
                    <Button variant="outline" className="commitment-open" aria-label={`Ver no extrato · ${tx.description} · ${formatDate(tx.date)}`}
                      onClick={() => onOpenTransaction(tx)}><List size={16} aria-hidden="true" /> Ver no extrato</Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <div className="commitments-empty">
          <CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-title">Nenhum compromisso cadastrado neste mês</p>
          {nextMonth && <Button variant="outline" onClick={() => {
            periodHeading.current?.focus();
            onMonthChange(nextMonth);
          }}>Ver {monthLabel(nextMonth)}</Button>}
        </div>
      ))}
    </section>
  );
}
