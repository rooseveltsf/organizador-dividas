import { useState } from 'react';
import { calendarMonthRange, type PurchaseSeries, type PurchaseSeriesSummary, type PurchaseTransaction,
  type RecurrenceAssumption } from '@organizador/shared';
import { formatDate, formatPeriod, monthLabel, shiftMonth } from '../calendar';
import { formatCurrency, formatCurrencyCents } from './MonthlySummary';
import { Button, Input, Select } from './ui';

type OpenTransaction = (tx: Pick<PurchaseTransaction, 'id' | 'date'>) => void;

type ChangeAssumption = (key: string, value?: RecurrenceAssumption) => void;

export function PurchaseRecurrenceFields({ groups, onChange }: { groups: PurchaseSeries[]; onChange: ChangeAssumption }) {
  if (!groups.length) return null;
  return (
    <details className="purchase-details" onInvalid={event => { event.currentTarget.open = true; }}>
      <summary>Confirmar fim ou continuidade das recorrências</summary>
      <p>A continuidade repete o valor e o dia do último lançamento até o fim da análise ou a data de fim informada. A tabela mostra esses valores como premissas. Lacunas entre registros continuam sinalizadas.</p>
      <ul className="purchase-adjustments">
        {groups.map(group => <li key={group.key}><RecurrenceField group={group} onChange={onChange} /></li>)}
      </ul>
    </details>
  );
}

function RecurrenceField({ group, onChange }: { group: PurchaseSeries; onChange: ChangeAssumption }) {
  const [mode, setMode] = useState('records');
  const [end, setEnd] = useState('');
  const last = group.transactions[group.transactions.length - 1];
  const day = last.date.slice(0, 10);
  const minimum = day.length === 7 ? calendarMonthRange(day).lte.toISOString().slice(0, 10) : day;
  const endValid = end.length === 10 && end >= minimum;
  return (
    <>
      <div><strong>{last.description}</strong><p>Último registro em {formatPeriod(day)} · {formatCurrency(last.amount)}</p></div>
      <Select value={mode} onChange={event => {
        const next = event.target.value;
        setMode(next);
        onChange(group.key, next === 'continue' ? { mode: 'continue' } : next === 'end' && endValid ? { mode: 'end', date: end } : undefined);
      }} label="Premissa na simulação"
        aria-label={'Premissa na simulação · ' + last.description}>
        <option value="records">Usar os meses cadastrados</option>
        <option value="continue">Assumir continuidade</option>
        <option value="end">Confirmar data de fim</option>
      </Select>
      {mode === 'end' && <Input type="date" min={minimum} value={end}
        hint="Escolha uma data a partir do último lançamento registrado."
        onChange={event => {
          const date = event.target.value;
          setEnd(date);
          onChange(group.key, date.length === 10 && date >= minimum ? { mode: 'end', date } : undefined);
        }} label="Data de fim" aria-label={'Data de fim · ' + last.description} />}
    </>
  );
}

export function PurchaseSeriesDetails({ series, onOpenTransaction }: {
  series: PurchaseSeriesSummary[];
  onOpenTransaction: OpenTransaction;
}) {
  if (!series.length) return null;
  return (
    <section className="purchase-series" aria-labelledby="purchase-series-title">
      <h3 id="purchase-series-title">Encerramentos e cobertura das séries</h3>
      <ul>
        {series.map(item => (
          <li key={item.key}>
            <h4>{item.description}</h4>
            {item.kind === 'installment' ? <InstallmentSummary series={item} /> : <RecurrenceSummary series={item} />}
            <details className="purchase-details">
              <summary>Ver lançamentos da série ({item.transactions.length})</summary>
              <p>{item.groupId ? <>Identificador da série <code>{item.groupId}</code></> : 'Lançamento sem vínculo de série.'}</p>
              <ul className="purchase-series-evidence">
                {item.transactions.map(tx => (
                  <Evidence key={tx.id} tx={tx} considered={item.consideredDates.get(tx.id)} onOpenTransaction={onOpenTransaction} />
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function installmentNumber(tx: PurchaseTransaction) {
  return tx.currentInstallment != null && tx.totalInstallments != null ? `${tx.currentInstallment}/${tx.totalInstallments}` : 'sem numeração';
}

function InstallmentSummary({ series }: { series: Extract<PurchaseSeriesSummary, { kind: 'installment' }> }) {
  const { lastIdentified, lastRegistered, incomplete, openCount, missing, end } = series;
  const finalMonth = end?.period.slice(0, 7);
  return (
    <>
      {lastIdentified && <p>Última parcela identificada ({installmentNumber(lastIdentified)}) de {formatCurrency(lastIdentified.amount)}, com vencimento em {formatPeriod(lastIdentified.date.slice(0, 10))}.</p>}
      {incomplete && (
        <>
          <p>Última parcela cadastrada na série incompleta ({installmentNumber(lastRegistered)}) em {formatPeriod(lastRegistered.date.slice(0, 10))}.</p>
          <p>{missing.length ? 'Faltam registros das parcelas ' + missing.map(({ first, last }) => first === last ? first : `${first} a ${last}`).join(', ') + '.'
            : 'A numeração cadastrada é insuficiente para identificar o fim.'} A quitação da série fica indeterminada.</p>
        </>
      )}
      {openCount > 0 && <p>{openCount === 1 ? '1 parcela cadastrada em aberto.' : `${openCount} parcelas cadastradas em aberto.`}</p>}
      {end?.settled ? <p>Dívida quitada em {formatPeriod(end.period)}, conforme as liquidações registradas.</p>
        : end && <p>Fim previsto em {formatPeriod(end.period)}, com {formatCurrencyCents(end.cents)} no último pagamento.
          {finalMonth && finalMonth !== '9999-12' && ` A partir de ${monthLabel(shiftMonth(finalMonth, 1))}, esse valor deixa de comprometer o orçamento neste cenário.`}</p>}
      {!incomplete && !end && <p>Faltam datas de liquidação para confirmar o fim da dívida.</p>}
    </>
  );
}

function RecurrenceSummary({ series }: { series: Extract<PurchaseSeriesSummary, { kind: 'recurrence' }> }) {
  const { lastRegistered, gap, assumption, type, firstHistoricalGap } = series;
  return (
    <>
      <p>{type === 'income' ? 'Receita recorrente' : 'Despesa recorrente'} com último lançamento cadastrado em {formatPeriod(lastRegistered.date.slice(0, 10))}.</p>
      {assumption?.mode === 'end' && <p>Fim confirmado para {formatDate(assumption.date)} como premissa da simulação.
        Depois dessa data, cessam as novas {type === 'income' ? 'entradas' : 'saídas'} da recorrência. Os lançamentos cadastrados seguem as datas exibidas abaixo.</p>}
      {assumption?.mode === 'continue' && <p>Continuidade assumida no cenário, com {formatCurrency(lastRegistered.amount)} por mês após a projeção cadastrada.</p>}
      {gap && <p>{gap.reason === 'missing_month' ? `Falta um lançamento da série em ${monthLabel(gap.month)}.`
        : `A projeção cadastrada acabou. Falta confirmar o que acontece a partir de ${monthLabel(gap.month)}.`}</p>}
      {firstHistoricalGap && <p>Há uma lacuna no histórico a partir de {monthLabel(firstHistoricalGap)}.</p>}
    </>
  );
}

function Evidence({ tx, considered, onOpenTransaction }: { tx: PurchaseTransaction; considered?: string; onOpenTransaction: OpenTransaction }) {
  const due = tx.date.slice(0, 10);
  const paid = tx.status === 'paid';
  return (
    <li>
      <div>
        <strong>{tx.description}</strong>
        <p>{tx.category === 'installment' && `Parcela ${installmentNumber(tx)} · `}{formatCurrency(tx.amount)} · Vencimento em {formatPeriod(due)}</p>
        <p>{paid ? (tx.paymentDate ? `Liquidado em ${formatPeriod(tx.paymentDate.slice(0, 10))}` : 'Liquidado sem data registrada') : 'Em aberto'}
          {!paid && considered && ` · Pagamento ou recebimento considerado em ${formatPeriod(considered)}`}</p>
      </div>
      <Button variant="outline" aria-label={`Ver no extrato · ${tx.description} · ${formatPeriod(due)}${tx.currentInstallment ? ` · parcela ${tx.currentInstallment}` : ''}`}
        onClick={() => onOpenTransaction(tx)}>Ver no extrato</Button>
    </li>
  );
}
