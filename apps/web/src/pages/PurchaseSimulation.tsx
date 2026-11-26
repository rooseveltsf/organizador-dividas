import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { calendarDay, calendarMonthRange, collectPurchaseSeries, MAX_SERIES_LENGTH, simulateMonthlyPurchase, type MonthlyPurchase,
  type MonthlyPurchaseRow, type RecurrenceAssumption, type ShoppingItem, type Transaction } from '@organizador/shared';
import { formatDate, monthLabel } from '../calendar';
import { formatCurrencyCents } from '../components/MonthlySummary';
import { NotebookProfileHeader } from '../components/NotebookHeader';
import { NotebookViews, type NotebookView } from '../components/NotebookViews';
import { PurchaseRecurrenceFields, PurchaseSeriesDetails } from '../components/PurchaseSeriesDetails';
import { Button, Input, Select } from '../components/ui';
import { useProfiles, useTransactions } from '../contexts';
import { moneyPattern, parseMoneyInput } from '../moneyInput';
import { shoppingListPath } from '../shoppingList';

const loadError = 'Não foi possível carregar os lançamentos deste perfil.';
type OpenTransaction = (tx: Pick<Transaction, 'id' | 'date'>) => void;

export function PurchaseSimulationPage({ onViewChange, onOpenTransaction, item }: {
  onViewChange: (view: NotebookView) => void;
  onOpenTransaction: OpenTransaction;
  item: ShoppingItem | null;
}) {
  const { activeProfile } = useProfiles();
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { heading.current?.focus(); }, []);

  if (!activeProfile) return null;
  return (
    <main className="notebook-page dashboard purchase-page">
      <NotebookProfileHeader />
      <NotebookViews current="purchase" onChange={onViewChange} />
      <header className="commitments-heading">
        <h1 ref={heading} tabIndex={-1}>Simular compra</h1>
        <p>Veja quanto sobra por mês e em quais meses a compra aperta o orçamento.</p>
      </header>
      <SimulationForm key={item?.id ?? activeProfile.id} profileId={activeProfile.id} item={item}
        onOpenTransaction={onOpenTransaction} onReset={() => onViewChange('purchase')} />
    </main>
  );
}

function SimulationForm({ profileId, item, onOpenTransaction, onReset }: {
  profileId: string; item: ShoppingItem | null; onOpenTransaction: OpenTransaction; onReset: () => void;
}) {
  const { requestProfileApi } = useProfiles();
  const { pendingRows } = useTransactions();
  const awaitingWrites = pendingRows.size > 0;
  const [rows, setRows] = useState<Transaction[] | 'error' | 'closed' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => calendarDay(new Date()));
  const [product, setProduct] = useState(item?.name ?? '');
  const [total, setTotal] = useState(item?.estimatedAmount?.toString() ?? '');
  const [payment, setPayment] = useState<string>(item ? item.paymentMethod ?? '' : 'cash');
  const [paymentDate, setPaymentDate] = useState(item ? (item.paymentMethod === 'cash' ? item.scheduledDate ?? '' : '') : today);
  const [firstDue, setFirstDue] = useState(item ? (item.paymentMethod === 'installments' ? item.scheduledDate ?? '' : '') : today);
  const [count, setCount] = useState(item ? item.installmentCount?.toString() ?? '' : '2');
  const [margin, setMargin] = useState('');
  const [assumptions, setAssumptions] = useState<ReadonlyMap<string, RecurrenceAssumption>>(new Map());
  const parcelled = payment === 'installments';

  useEffect(() => {
    setRows(null);
    if (awaitingWrites) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ profileId });
    async function load() {
      try {
        const data = await requestProfileApi<Transaction[]>('/transactions?' + query, loadError, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error(loadError);
        if (item) {
          // Consulte o item depois do Extrato para evitar reaplicar uma compra já registrada.
          const current = await requestProfileApi<ShoppingItem>(
            shoppingListPath(profileId, item.id), loadError, { signal: controller.signal },
          );
          if (!current) throw new Error(loadError);
          if (current.purchasedAt || current.archivedAt) {
            if (!controller.signal.aborted) setRows('closed');
            return;
          }
        }
        if (!controller.signal.aborted) setRows(data.filter(tx => tx.profileId === profileId));
      } catch {
        if (!controller.signal.aborted) setRows('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [profileId, item, awaitingWrites, attempt, requestProfileApi]);

  const result = useMemo(() => !awaitingWrites && payment && Array.isArray(rows) && simulateMonthlyPurchase({ profileId, today,
    total: parseMoneyInput(total), firstDue: parcelled ? firstDue : paymentDate, installments: parcelled ? Number(count) : 1,
    margin: parseMoneyInput(margin), recurrenceAssumptions: assumptions,
  }, rows), [awaitingWrites, rows, profileId, today, total, payment, parcelled, firstDue, paymentDate, count, margin, assumptions]);
  const recurrences = useMemo(() => result && Array.isArray(rows)
    ? collectPurchaseSeries(profileId, rows, today, calendarMonthRange(result.rows[result.rows.length - 1].month).lte.toISOString().slice(0, 10))
      .filter(series => series.kind === 'recurrence') : [],
  [profileId, rows, today, result]);

  if (rows === 'closed') return (
    <div className="commitments-empty">
      <p role="status">O item já foi concluído ou arquivado na Lista de compras.</p>
      <Button variant="outline" onClick={onReset}>Nova simulação</Button>
    </div>
  );

  return (
    <>
      <form className="purchase-form" onSubmit={event => event.preventDefault()}>
        <div className="purchase-fields">
          <Input label="Nome do produto (opcional)" name="product" value={product} onChange={event => setProduct(event.target.value)} />
          <Input label="Valor total da oferta (R$)" name="total" required inputMode="decimal" pattern={moneyPattern} value={total}
            onChange={event => setTotal(event.target.value)} hint={parcelled ? 'Informe o total real da oferta parcelada, incluindo juros ou acréscimos.' : undefined} />
          <Select label="Forma de pagamento" name="payment" required value={payment} onChange={event => setPayment(event.target.value)}>
            {item && <option value="" disabled>Selecione</option>}
            <option value="cash">À vista</option>
            <option value="installments">Parcelada</option>
          </Select>
          {parcelled ? <>
            <Input label="Quantidade de parcelas" name="count" type="number" required min="1" max={MAX_SERIES_LENGTH} step="1" value={count}
              onChange={event => setCount(event.target.value)} />
            <Input label="Primeiro vencimento" name="firstDue" type="date" required min={today} value={firstDue} onChange={event => setFirstDue(event.target.value)} />
          </> : payment === 'cash' && <Input label="Data do pagamento" name="paymentDate" type="date" required min={today} value={paymentDate}
            onChange={event => setPaymentDate(event.target.value)} />}
        </div>
        <details className="purchase-details">
          <summary>Margem e premissas opcionais</summary>
          <Input label="Margem mensal (R$)" name="margin" inputMode="decimal" pattern={moneyPattern} value={margin}
            hint="Sinaliza os meses em que a sobra com a compra fica abaixo desse valor." onChange={event => setMargin(event.target.value)} />
          <PurchaseRecurrenceFields groups={recurrences} onChange={(key, value) => setAssumptions(previous => {
            const next = new Map(previous);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
          })} />
        </details>
      </form>
      {(awaitingWrites || rows === null) && <p role="status">Carregando lançamentos do perfil…</p>}
      {rows === 'error' && <div className="purchase-results"><p role="alert">{loadError}</p>
        <Button variant="outline" onClick={() => { setRows(null); setAttempt(previous => previous + 1); }}>Tentar novamente</Button>
      </div>}
      {!result && Array.isArray(rows) && !awaitingWrites && <p className="purchase-results" role="status">
        {total ? 'Confira o valor total, a forma de pagamento e a data. Cada parcela precisa valer pelo menos R$ 0,01.'
          : 'Informe o valor total da oferta para ver a comparação mensal.'}</p>}
      {result && <MonthlyResult result={result} product={product.trim()} onOpenTransaction={onOpenTransaction} />}
    </>
  );
}

function resultText(row: MonthlyPurchaseRow) {
  if (row.withPurchase < 0n) return `Faltariam ${formatCurrencyCents(-row.withPurchase)} com a compra nas condições simuladas.`;
  if (row.withPurchase > 0n) return `Sobrariam ${formatCurrencyCents(row.withPurchase)} com a compra.`;
  return 'A sobra com a compra seria zero.';
}

function MonthlyResult({ result, product, onOpenTransaction }: { result: MonthlyPurchase; product: string; onOpenTransaction: OpenTransaction }) {
  const { rows, tightest, firstNegative, relief, series } = result;
  const incomplete = rows.some(row => row.missing.length);
  return (
    <section className="purchase-results" aria-labelledby="purchase-result-title">
      <h2 id="purchase-result-title">Sobra mensal projetada</h2>
      {product && <p className="purchase-product">Compra simulada de <strong>{product}</strong></p>}
      <p>Receitas previstas menos despesas previstas do mês, como no Extrato. A tabela mostra o efeito da compra nessa diferença.</p>
      <div className="purchase-highlight" aria-live="polite">
        <p><strong>Mês mais apertado · {monthLabel(tightest.month)}</strong>. {resultText(tightest)}</p>
        <p>{firstNegative ? <><strong>Primeiro mês negativo · {monthLabel(firstNegative.month)}</strong>
          {firstNegative.month !== tightest.month && <>. {resultText(firstNegative)}</>}</> : 'Nenhum mês negativo nos valores projetados.'}</p>
        {incomplete && <p><strong>Análise incompleta.</strong> Os meses sinalizados têm dados ausentes. {tightest.missing.length
          ? 'Os valores e destaques são parciais.' : 'Os destaques consideram os meses com dados disponíveis.'}</p>}
      </div>
      <div className="purchase-table-scroll" role="region" aria-label="Comparação mensal com e sem a compra" tabIndex={0}>
        <table className="purchase-table">
          <thead><tr>{['Mês', 'Receitas cadastradas', 'Despesas existentes', 'Nova compra', 'Sobra sem a compra', 'Sobra com a compra']
            .map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.month} data-month={row.month} data-negative={row.withPurchase < 0n} data-tightest={row.month === tightest.month}>
              <th scope="row">{monthLabel(row.month)}
                {row.month === tightest.month && <small>Mais apertado</small>}
                {row.month === firstNegative?.month && <small>Primeiro negativo</small>}
                {!!row.missing.length && <details><summary>Dados incompletos</summary><small>{row.missing.join(' · ')}</small></details>}
              </th>
              <td>{formatCurrencyCents(row.income)}{row.assumedIncome > 0n && <small>+ {formatCurrencyCents(row.assumedIncome)} de premissas</small>}</td>
              <td>{formatCurrencyCents(row.expenses)}{row.assumedExpenses > 0n && <small>+ {formatCurrencyCents(row.assumedExpenses)} de premissas</small>}</td>
              <td>{formatCurrencyCents(row.purchase)}{row.purchaseDate && <small>{formatDate(row.purchaseDate)}</small>}</td>
              <td>{formatCurrencyCents(row.withoutPurchase)}</td>
              <td><strong>{formatCurrencyCents(row.withPurchase)}</strong>{row.belowMargin && <small>Abaixo da margem</small>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!!relief.length && <details className="purchase-details">
        <summary>Quando as parcelas existentes saem da projeção</summary>
        <ul>{relief.map(item => <li key={item.key}>{item.description} · a partir de {monthLabel(item.month).toLowerCase()},
          os {formatCurrencyCents(item.cents)} de parcelas previstas no mês anterior saem da projeção mensal.</li>)}</ul>
      </details>}
      <details className="purchase-details">
        <summary>O que já foi recebido ou pago</summary>
        <p>Valores marcados como recebidos ou pagos, agrupados pelo mês do lançamento como no Extrato.</p>
        <ul className="purchase-settled">{rows.map(row => <li key={row.month}><strong>{monthLabel(row.month)}</strong>
          <span>Recebido {formatCurrencyCents(row.received)}</span><span>Pago {formatCurrencyCents(row.paid)}</span></li>)}</ul>
      </details>
      <PurchaseSeriesDetails series={series} onOpenTransaction={onOpenTransaction} />
    </section>
  );
}
