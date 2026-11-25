import React, { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Transaction, TransactionCategory, TransactionType } from '@organizador/shared';
import { useTransactions } from '../contexts/TransactionContext';
import { Button, Input, Select } from './ui';
import { formatCurrency } from './MonthlySummary';

export interface TransactionFormProps {
  initialData?: Transaction;
  fixedType?: TransactionType;
  onSuccess?: () => void;
  onCancel?: () => void;
  onSavingChange?: (saving: boolean) => void;
}

const categories = {
  daily: ['Cotidiana', 'Uma movimentação avulsa, como uma compra de mercado ou um trabalho extra.'],
  fixed: ['Fixa', 'Um valor previsto todos os meses, como aluguel ou salário.'],
  recurring: ['Recorrente', 'Uma cobrança ou entrada que se repete, como uma assinatura.'],
  installment: ['Parcelada', 'Uma compra dividida em parcelas mensais. A data informada vale para a parcela atual.'],
} satisfies Record<TransactionCategory, string[]>;

function periodDate(month: number, year: number) {
  const today = new Date();
  const day = month === today.getMonth() + 1 && year === today.getFullYear() ? today.getDate() : 1;
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function monthlyDate(base: Date, offset: number) {
  const last = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0, 12);
  last.setDate(Math.min(last.getDate(), base.getDate()));
  return last;
}

function moneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function TransactionForm({ initialData, fixedType, onSuccess, onCancel, onSavingChange }: TransactionFormProps) {
  const { addTransaction, updateTransaction, selectedMonth, selectedYear } = useTransactions();
  const initialType = fixedType ?? initialData?.type ?? 'expense';
  const [type, setType] = useState(initialType);
  const defaultCategory = initialType === 'expense' ? 'installment' : 'fixed';
  const [category, setCategory] = useState<TransactionCategory>(initialData?.category ?? defaultCategory);
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [amount, setAmount] = useState(initialData ? String(initialData.amount).replace('.', ',') : '');
  const [date, setDate] = useState(() => initialData?.date.split('T')[0] ?? periodDate(selectedMonth, selectedYear));
  const [byTotal, setByTotal] = useState(false);
  const [current, setCurrent] = useState(String(initialData?.currentInstallment ?? 1));
  const [total, setTotal] = useState(String(initialData?.totalInstallments ?? (initialData?.category === 'installment' ? 1 : 2)));
  const [months, setMonths] = useState('12');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const helpId = useId();
  const installment = category === 'installment';
  const repeats = !initialData && (category === 'fixed' || category === 'recurring');
  const count = Number(total);
  const first = Number(current);
  const monthsCount = Number(months);
  const cents = Math.round(Number(amount.trim().replace(',', '.')) * 100);
  const unit = installment && byTotal ? Math.round(cents / count) : cents;
  const base = new Date(date + 'T12:00:00');
  const generated = initialData ? 1 : installment ? count - first + 1 : repeats ? monthsCount : 1;
  const last = monthlyDate(base, generated - 1);
  const errors: Record<string, string> = {};
  if (!description.trim()) errors.description = 'Informe a descrição.';
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(cents) || cents <= 0)
    errors.amount = 'Informe um valor positivo com até duas casas decimais.';
  else if (installment && byTotal && count > 0 && unit < 1)
    errors.amount = 'Cada parcela precisa valer pelo menos R$ 0,01.';
  if (!Number.isFinite(base.getTime())) errors.date = 'Informe uma data válida.';
  if (installment) {
    if (!Number.isInteger(count) || count < 1 || count > 120) errors.total = 'Informe um total de 1 a 120 parcelas.';
    if (!Number.isInteger(first) || first < 1 || first > count) errors.current = 'Informe uma parcela entre 1 e o total de parcelas.';
  }
  if (repeats && (!Number.isSafeInteger(monthsCount) || monthsCount < 1 || (!errors.date && !Number.isFinite(last.getTime()))))
    errors.months = 'Informe uma quantidade inteira de meses com uma data final válida.';
  const canPreview = !Object.keys(errors).some(key => key !== 'description');
  const error = (name: string) => attempted ? errors[name] : undefined;

  function changeMode(next: boolean) {
    if (next === byTotal) return;
    if (!errors.amount && !errors.total && amount.trim()) setAmount(moneyInput(next ? cents * count : unit));
    setByTotal(next);
  }

  function changeCategory(next: TransactionCategory) {
    if (installment && byTotal && next !== 'installment') changeMode(false);
    setCategory(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFailure('');
    if (Object.keys(errors).length) {
      const invalid = Array.from(event.currentTarget.querySelectorAll('input')).find(field => errors[field.name]);
      flushSync(() => setAttempted(true));
      if (invalid && invalid === document.activeElement) {
        setFailure(errors[invalid.name]);
      }
      invalid?.focus();
      return;
    }
    const fields = {
      description: description.trim(), amount: unit / 100, type, category, date,
      ...(installment && { currentInstallment: first, totalInstallments: count }),
    };
    setSaving(true);
    onSavingChange?.(true);
    try {
      if (initialData) {
        await updateTransaction(initialData.id, {
          ...fields,
          ...(initialData.category === 'installment' && !installment && { currentInstallment: null, totalInstallments: null }),
        });
      } else {
        await addTransaction({ ...fields, profileId: '', status: 'pending', ...(repeats && { repeatMonths: monthsCount }) });
        setDescription('');
        setAmount('');
        setCurrent('1');
        setTotal('2');
        setMonths('12');
        setByTotal(false);
        setCategory(defaultCategory);
        setAttempted(false);
      }
      onSuccess?.();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="transaction-form">
      {initialData && <p className="transaction-scope">A edição altera somente este lançamento, inclusive quando ele faz parte de uma série.</p>}
      {!fixedType && <Select label="Tipo" value={type} onChange={e => {
        const next = e.target.value as TransactionType;
        setType(next);
        if (next === 'income' && installment) changeCategory('fixed');
      }}><option value="expense">Despesa</option><option value="income">Receita</option></Select>}
      <Input label="Descrição" name="description" data-initial-focus required placeholder={type === 'expense' ? 'Ex.: aluguel' : 'Ex.: salário'}
        value={description} onChange={e => setDescription(e.target.value)} errorMessage={error('description')} />
      <div className="transaction-pair">
        <Input label={installment ? (byTotal ? 'Total da compra (R$)' : 'Valor da parcela (R$)') : 'Valor (R$)'}
          name="amount" inputMode="decimal" hint="Informe até duas casas decimais. Exemplo: 125,50." required value={amount}
          onChange={e => setAmount(e.target.value)} errorMessage={error('amount')} />
        <Input label={type === 'income' ? 'Data de recebimento' : 'Data de vencimento'} name="date" type="date"
          value={date} required onChange={e => setDate(e.target.value)} errorMessage={error('date')} />
      </div>
      <div>
        <Select label="Categoria" value={category} aria-describedby={helpId} onChange={e => changeCategory(e.target.value as TransactionCategory)}>
          {(Object.keys(categories) as TransactionCategory[]).filter(key => key !== 'installment' || type === 'expense' || installment)
            .map(key => <option key={key} value={key}>{categories[key][0]}</option>)}
        </Select>
        <p className="transaction-help" id={helpId}>{categories[category][1]}</p>
      </div>
      {installment && <>
        <fieldset className="transaction-mode">
          <legend>Como informar o valor?</legend>
          <label><input type="radio" name="mode" checked={!byTotal} onChange={() => changeMode(false)} /> Por parcela</label>
          <label><input type="radio" name="mode" checked={byTotal} onChange={() => changeMode(true)} /> Pela compra inteira</label>
        </fieldset>
        <div className="transaction-pair">
          <Input label="Parcela atual" name="current" type="number" min={1} max={count || undefined} required value={current}
            onChange={e => setCurrent(e.target.value)} errorMessage={error('current')} />
          <Input label="Total de parcelas" name="total" type="number" min={1} max={120} required value={total}
            onChange={e => setTotal(e.target.value)} errorMessage={error('total')} />
        </div>
      </>}
      {repeats && <Input label="Quantidade de meses (inclui o primeiro)" type="number" name="months" required min={1}
        value={months} onChange={e => setMonths(e.target.value)} errorMessage={error('months')} />}
      <div className="transaction-preview">
        <strong>{initialData ? 'Após a alteração' : 'Ao salvar'}</strong>
        {canPreview ? <>
          <p>{generated === 1 ? '1 lançamento' : generated + ' lançamentos mensais'} de {formatCurrency(unit / 100)}
            {generated === 1 ? ' em ' : ' cada, de '}{base.toLocaleDateString('pt-BR')}
            {generated > 1 && ' até ' + last.toLocaleDateString('pt-BR')}.</p>
          {installment && <p>{!initialData && generated > 1 ? 'Parcelas ' + first + ' a ' + count : 'Parcela ' + first + ' de ' + count}
            {' · Total ' + formatCurrency(unit * generated / 100)}</p>}
          {installment && byTotal && unit * count !== cents && <p>Com o arredondamento por parcela, a compra soma {formatCurrency(unit * count / 100)}.</p>}
        </> : <p>Preencha os valores e a data para conferir o lançamento.</p>}
      </div>
      <p className="transaction-error" role="alert">{failure}</p>
      <p role="status">{saving ? 'Salvando o lançamento…' : ''}</p>
      <div className="transaction-actions">
        <Button type="submit" aria-disabled={saving || undefined}>{initialData ? 'Salvar alterações' : 'Salvar lançamento'}</Button>
        {onCancel && <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}
