import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { MAX_SERIES_LENGTH, shoppingItemSchema, shoppingPurchaseCandidate, shoppingPurchaseSchema,
  type ShoppingItem, type ShoppingItemInput, type ShoppingPurchaseOverrides, type Transaction } from '@organizador/shared';
import { formatDate } from '../calendar';
import { formatCurrency } from '../components/MonthlySummary';
import { NotebookProfileHeader } from '../components/NotebookHeader';
import { NotebookViews, type NotebookView } from '../components/NotebookViews';
import { Button, Input, Modal, Select } from '../components/ui';
import { useProfiles, useTransactions } from '../contexts';
import { moneyPattern, parseMoneyInput } from '../moneyInput';
import { shoppingListPath } from '../shoppingList';

type StatementTarget = Pick<Transaction, 'id' | 'date'>;
type Payment = NonNullable<ShoppingItem['paymentMethod']> | '';
type Dialog = { kind: 'edit'; item?: ShoppingItem } | { kind: 'complete'; item: ShoppingItem; correctAmount: boolean };
const loadError = 'Não foi possível carregar a Lista de compras.';
const paymentLabel = (payment: NonNullable<ShoppingItem['paymentMethod']>) => payment === 'cash' ? 'À vista' : 'Parcelada';
const dateLabel = (payment: Payment) => payment === 'installments' ? 'Primeiro vencimento' : 'Data do pagamento';

export function ShoppingList({ profileId, onViewChange, onOpenTransaction, onSimulate }: {
  profileId: string;
  onViewChange: (view: NotebookView) => void;
  onOpenTransaction: (target: StatementTarget) => void;
  onSimulate: (item: ShoppingItem) => void;
}) {
  const { requestProfileApi } = useProfiles();
  const { completeShoppingItem, pendingRows } = useTransactions();
  const heading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const awaitingPurchase = Array.from(pendingRows.values()).includes('purchase');
  const hasItems = items !== null;
  useLayoutEffect(() => { heading.current?.focus(); }, []);

  useEffect(() => {
    if (awaitingPurchase || hasItems) return;
    const controller = new AbortController();
    async function load() {
      try {
        const data = await requestProfileApi<ShoppingItem[]>(shoppingListPath(profileId), loadError, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error(loadError);
        if (!controller.signal.aborted) setItems(data);
      } catch {
        if (!controller.signal.aborted) setFailedLoad(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [profileId, attempt, requestProfileApi, awaitingPurchase, hasItems]);

  function openDialog(next: Dialog | null) {
    setError('');
    setDialog(next);
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível realizar a ação.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function replaceItem(next: ShoppingItem) {
    setItems(previous => previous?.some(item => item.id === next.id)
      ? previous.map(item => item.id === next.id ? next : item)
      : [next, ...(previous ?? [])]);
  }

  function save(data: ShoppingItemInput, item?: ShoppingItem) {
    void run(async () => {
      const message = 'Não foi possível salvar o item. Tente novamente.';
      const next = await requestProfileApi<ShoppingItem>(shoppingListPath(profileId, item?.id), message, {
        method: item ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!next) throw new Error(message);
      replaceItem(next);
      setDialog(null);
      setNotice(item ? 'Item atualizado.' : 'Item adicionado à Lista de compras.');
    });
  }

  function complete(item: ShoppingItem, overrides?: ShoppingPurchaseOverrides) {
    void run(async () => {
      const bought = await completeShoppingItem(item.id, overrides);
      replaceItem(bought);
      setDialog(null);
      setNotice('Compra registrada no Extrato.');
    });
  }

  function archive(item: ShoppingItem) {
    void run(async () => {
      const message = 'Não foi possível arquivar o item. Tente novamente.';
      const next = await requestProfileApi<ShoppingItem>(shoppingListPath(profileId, item.id) + '/archive', message, {
        method: 'POST',
      });
      if (!next) throw new Error(message);
      replaceItem(next);
      setNotice('Item arquivado.');
    });
  }

  function openStatement(item: ShoppingItem) {
    void run(async () => {
      const message = 'Não foi possível localizar o lançamento no Extrato.';
      const target = await requestProfileApi<StatementTarget>(shoppingListPath(profileId, item.id) + '/transaction', message);
      if (!target) throw new Error(message);
      if (heading.current) onOpenTransaction(target);
    });
  }

  const planned = items?.filter(item => !item.purchasedAt && !item.archivedAt) ?? [];
  const bought = items?.filter(item => item.purchasedAt && !item.archivedAt) ?? [];
  const archived = items?.filter(item => item.archivedAt) ?? [];

  return (
    <main className="notebook-page dashboard shopping-page">
      <NotebookProfileHeader />
      <NotebookViews current="shopping" onChange={onViewChange} />
      <header className="commitments-heading shopping-heading">
        <h1 ref={heading} tabIndex={-1}>Lista de compras</h1>
        <Button disabled={busy || items === null} onClick={() => openDialog({ kind: 'edit' })}>
          <Plus size={17} aria-hidden="true" /> Adicionar item
        </Button>
      </header>
      <p className="transaction-notice" role="status">{notice}</p>
      {error && !dialog && <p className="transaction-error shopping-message" role="alert">{error}</p>}
      {items === null && (failedLoad
        ? <div className="commitments-empty"><p className="transaction-error" role="alert">{loadError}</p>
          <Button variant="outline" onClick={() => { setFailedLoad(false); setAttempt(previous => previous + 1); }}>
            Tentar novamente
          </Button></div>
        : <p className="commitments-empty" role="status">Carregando lista…</p>)}
      {items !== null && (
        <>
          <section className="shopping-section" aria-labelledby="shopping-planned">
            <h2 id="shopping-planned">A comprar</h2>
            {planned.length ? <ul className="shopping-items">{planned.map(item => {
              const ready = shoppingPurchaseSchema.safeParse(shoppingPurchaseCandidate(item)).success;
              return (
                <ItemRow key={item.id} item={item}>
                  <Button disabled={busy} onClick={() => ready ? complete(item) : openDialog({ kind: 'complete', item, correctAmount: false })}>
                    Marcar como comprado
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => onSimulate(item)}>Abrir na Calculadora</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => openDialog({ kind: 'edit', item })}>Editar</Button>
                  {ready && <Button variant="ghost" disabled={busy} onClick={() => openDialog({ kind: 'complete', item, correctAmount: true })}>
                    Corrigir valor e concluir
                  </Button>}
                  <Button variant="ghost" disabled={busy} onClick={() => archive(item)}>Arquivar</Button>
                </ItemRow>
              );
            })}</ul> : <p className="commitments-empty">Nenhum item a comprar.</p>}
          </section>
          {!!bought.length && <section className="shopping-section" aria-labelledby="shopping-bought">
            <h2 id="shopping-bought">Comprados</h2>
            <ul className="shopping-items">{bought.map(item => <ItemRow key={item.id} item={item}>
              <Button variant="outline" disabled={busy} onClick={() => openStatement(item)}>Ver no Extrato</Button>
              <Button variant="ghost" disabled={busy} onClick={() => archive(item)}>Arquivar</Button>
            </ItemRow>)}</ul>
          </section>}
          {!!archived.length && <details className="purchase-details shopping-section">
            <summary>Arquivados</summary>
            <ul className="shopping-items">{archived.map(item => <ItemRow key={item.id} item={item}>
              {item.purchasedAt && <Button variant="outline" disabled={busy} onClick={() => openStatement(item)}>Ver no Extrato</Button>}
            </ItemRow>)}</ul>
          </details>}
        </>
      )}
      {dialog?.kind === 'edit' && <EditItem item={dialog.item} onSave={data => save(data, dialog.item)}
        onClose={() => openDialog(null)} busy={busy} error={error} />}
      {dialog?.kind === 'complete' && <ConfirmPurchase item={dialog.item} correctAmount={dialog.correctAmount}
        onConfirm={data => complete(dialog.item, data)} onClose={() => openDialog(null)} busy={busy} error={error} />}
    </main>
  );
}

function ItemRow({ item, children }: { item: ShoppingItem; children: React.ReactNode }) {
  const payment = item.purchasedAt ? item.actualPaymentMethod : item.paymentMethod;
  const amount = item.purchasedAt ? item.actualAmount : item.estimatedAmount;
  const count = item.purchasedAt ? item.actualInstallmentCount : item.installmentCount;
  const date = item.purchasedAt ? item.actualDate : item.scheduledDate;
  return (
    <li className="shopping-item">
      <div>
        <h3>{item.name}</h3>
        <p>{[
          amount == null ? 'Sem preço estimado' : (item.purchasedAt ? 'Valor real ' : 'Estimado ') + formatCurrency(amount),
          payment && paymentLabel(payment),
          count && (count === 1 ? '1 parcela' : count + ' parcelas'),
          date && dateLabel(payment ?? '') + ' em ' + formatDate(date),
        ].filter(Boolean).join(' · ')}</p>
        {item.purchasedAt && item.estimatedAmount != null && item.estimatedAmount !== amount &&
          <p>Estimativa inicial {formatCurrency(item.estimatedAmount)}</p>}
      </div>
      <div className="shopping-actions">{children}</div>
    </li>
  );
}

function PaymentField({ value, required, onChange }: {
  value: Payment; required?: boolean; onChange: (payment: Payment) => void;
}) {
  return <Select label={required ? 'Forma de pagamento' : 'Forma de pagamento (opcional)'} value={value} required={required}
    onChange={event => onChange(event.target.value as Payment)}>
    <option value="">{required ? 'Selecione' : 'A definir'}</option>
    <option value="cash">À vista</option>
    <option value="installments">Parcelada</option>
  </Select>;
}

type DialogProps = { busy: boolean; error: string; onClose: () => void };

function EditItem({ item, onSave, busy, error, onClose }: DialogProps & {
  item?: ShoppingItem; onSave: (data: ShoppingItemInput) => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item?.estimatedAmount?.toString() ?? '');
  const [payment, setPayment] = useState<Payment>(item?.paymentMethod ?? '');
  const [count, setCount] = useState(item?.installmentCount?.toString() ?? '');
  const [date, setDate] = useState(item?.scheduledDate ?? '');
  const [validation, setValidation] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = shoppingItemSchema.safeParse({
      name, estimatedAmount: amount ? parseMoneyInput(amount) : null, paymentMethod: payment || null,
      installmentCount: count ? Number(count) : null, scheduledDate: date || null,
    });
    setValidation(parsed.success ? '' : parsed.error.issues[0].message);
    if (parsed.success) onSave(parsed.data);
  }

  return <Modal isOpen title={item ? 'Editar item' : 'Adicionar item'} onClose={onClose} dismissDisabled={busy}>
    <form className="shopping-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <Input label="Nome do item" required maxLength={200} value={name} onChange={event => setName(event.target.value)} />
        <Input label="Preço estimado (opcional)" inputMode="decimal" pattern={moneyPattern} value={amount}
          onChange={event => setAmount(event.target.value)} />
        <PaymentField value={payment} onChange={next => { setPayment(next); setDate(''); setCount(''); }} />
        {payment === 'installments' && <Input label="Quantidade de parcelas (opcional)" type="number" min="1" max={MAX_SERIES_LENGTH}
          value={count} onChange={event => setCount(event.target.value)} />}
        {payment && <Input label={dateLabel(payment) + ' (opcional)'} type="date" value={date} onChange={event => setDate(event.target.value)} />}
      </fieldset>
      <DialogActions busy={busy} onClose={onClose} error={validation || error} label="Salvar item" />
    </form>
  </Modal>;
}

function ConfirmPurchase({ item, correctAmount, onConfirm, busy, error, onClose }: DialogProps & {
  item: ShoppingItem; correctAmount: boolean; onConfirm: (data: ShoppingPurchaseOverrides) => void;
}) {
  const initial = shoppingPurchaseSchema.safeParse(shoppingPurchaseCandidate(item));
  const invalid = (field: string) => !initial.success && initial.error.issues.some(issue => issue.path[0] === field);
  const [showAmount, setShowAmount] = useState(correctAmount || invalid('amount'));
  const [dateInvalid, setDateInvalid] = useState(invalid('date'));
  const [amount, setAmount] = useState(item.estimatedAmount?.toString() ?? '');
  const [payment, setPayment] = useState<Payment>(item.paymentMethod ?? '');
  const [count, setCount] = useState(item.installmentCount?.toString() ?? '');
  const [date, setDate] = useState(item.scheduledDate ?? '');
  const [validation, setValidation] = useState('');
  const showCount = payment === 'installments' && (item.installmentCount == null || invalid('amount') && item.estimatedAmount != null);
  const showDate = Boolean(payment && (!item.scheduledDate || dateInvalid));
  const conditions = [
    item.paymentMethod && paymentLabel(item.paymentMethod),
    payment === 'installments' && !showCount && count && (count === '1' ? '1 parcela' : count + ' parcelas'),
    !showDate && date && dateLabel(payment) + ' em ' + formatDate(date),
  ].filter(Boolean).join(' · ');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const overrides: ShoppingPurchaseOverrides = {
      amount: showAmount ? parseMoneyInput(amount) : undefined,
      paymentMethod: item.paymentMethod ? undefined : payment || undefined,
      installmentCount: showCount ? Number(count) : undefined,
      date: showDate ? date : undefined,
    };
    const parsed = shoppingPurchaseSchema.safeParse(shoppingPurchaseCandidate(item, overrides));
    setValidation(parsed.success ? '' : parsed.error.issues[0].message);
    if (parsed.success) onConfirm(overrides);
    else if (parsed.error.issues.some(issue => issue.path[0] === 'date')) setDateInvalid(true);
  }

  return <Modal isOpen title="Confirmar compra" description={item.name} onClose={onClose} dismissDisabled={busy}>
    <form className="shopping-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {conditions && <p className="shopping-conditions">{conditions}</p>}
        {showAmount ? <Input label="Valor real da compra (R$)" required inputMode="decimal" pattern={moneyPattern}
          value={amount} onChange={event => setAmount(event.target.value)} /> : <div className="shopping-actions shopping-conditions">
          <p>Valor da compra {formatCurrency(item.estimatedAmount!)}</p>
          <Button variant="ghost" size="sm" onClick={() => setShowAmount(true)}>Corrigir valor</Button>
        </div>}
        {!item.paymentMethod && <PaymentField value={payment} required onChange={next => {
          setPayment(next);
          setDate('');
        }} />}
        {showCount && <Input label="Quantidade de parcelas" required type="number" min="1" max={MAX_SERIES_LENGTH}
          value={count} onChange={event => setCount(event.target.value)} />}
        {showDate && <Input label={dateLabel(payment)} type="date" required
          value={date} onChange={event => setDate(event.target.value)} />}
      </fieldset>
      <DialogActions busy={busy} onClose={onClose} error={validation || error} label="Confirmar compra" />
    </form>
  </Modal>;
}

function DialogActions({ busy, onClose, error, label }: DialogProps & { label: string }) {
  return <>
    {error && <p className="transaction-error" role="alert">{error}</p>}
    <div className="shopping-actions shopping-dialog-actions">
      <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
      <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : label}</Button>
    </div>
  </>;
}
