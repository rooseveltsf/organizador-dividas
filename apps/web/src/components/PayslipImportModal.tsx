import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from 'lucide-react';
import type {
  BatchCreateTransactionDTO,
  PayslipParseResult,
  TransactionCategory,
  TransactionType,
} from '@organizador/shared';
import {
  MAX_SERIES_LENGTH, addMonths, calendarDateSchema, parseCalendarDate,
  toCents, transactionCount, validMoneyCents,
} from '@organizador/shared';
import { useProfiles } from '../contexts/ProfileContext';
import { useTransactions } from '../contexts/TransactionContext';
import { requestApi } from '../api';
import { Button, Input, ModalLayer, Select } from './ui';
import './PayslipImportModal.css';

const steps = ['Arquivo', 'Conferência', 'Lançamentos', 'Confirmação'] as const;
type Step = (typeof steps)[number];
type BatchItem = BatchCreateTransactionDTO['transactions'][number];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const calendarDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

export interface PayslipImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditablePayslipItem {
  tempId: string;
  rawCode?: string;
  description: string;
  reference?: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  currentInstallment?: number;
  totalInstallments?: number;
  isAdvance?: boolean;
  suggestedDate?: string;
  selected: boolean;
}

function countEntries(count: number) {
  return count + (count === 1 ? ' lançamento' : ' lançamentos');
}

function validAmount(amount: number) {
  return validMoneyCents(toCents(amount));
}

function validInstallments(item: EditablePayslipItem) {
  const current = item.currentInstallment ?? 0;
  const total = item.totalInstallments ?? 0;
  return (
    Number.isSafeInteger(current) &&
    Number.isSafeInteger(total) &&
    current >= 1 &&
    current <= total &&
    total <= MAX_SERIES_LENGTH
  );
}

function periodLabel(date: string, count: number) {
  const start = parseCalendarDate(date);
  if (count === 1) return calendarDate.format(start);
  const end = addMonths(start, count - 1);
  return month.format(start) + ' a ' + month.format(end);
}

function Notice({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="payslip-notice" role="note" id={id}>
      <AlertCircle size={17} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function EntryFields({
  item,
  date,
  itemLabel,
  descriptionId,
  update,
}: {
  item: EditablePayslipItem;
  date: string;
  itemLabel: string;
  descriptionId: string;
  update: (change: Partial<EditablePayslipItem>) => void;
}) {
  return (
    <fieldset disabled={!item.selected} className="payslip-fields">
      <legend className="sr-only">Dados de {itemLabel}</legend>
      <div className="wide">
        <Input
          size="sm"
          label="Descrição"
          id={descriptionId}
          value={item.description}
          errorMessage={
            item.selected && !item.description.trim() ? 'Informe a descrição.' : undefined
          }
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>
      <Input
        size="sm"
        label="Valor (R$)"
        type="number"
        min="0.01"
        step="0.01"
        value={item.amount || ''}
        errorMessage={
          item.selected && !validAmount(item.amount)
            ? 'Informe um valor maior que zero.'
            : undefined
        }
        onChange={(e) => update({ amount: e.target.valueAsNumber || 0 })}
      />
      <Input
        size="sm"
        label="Data do lançamento"
        type="date"
        value={date}
        errorMessage={item.selected && !calendarDateSchema.safeParse(date).success ? 'Informe uma data válida.' : undefined}
        onChange={(e) => update({ suggestedDate: e.target.value })}
      />
    </fieldset>
  );
}

function ImportSession({ onClose, onSuccess }: Omit<PayslipImportModalProps, 'isOpen'>) {
  const { activeProfile } = useProfiles();
  const { refreshTransactions } = useTransactions();
  const [step, setStep] = useState<Step>('Arquivo');
  const [pane, setPane] = useState<'document' | 'review'>('review');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [parsed, setParsed] = useState<PayslipParseResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState('');
  const [fileError, setFileError] = useState('');
  const [mode, setMode] = useState<'net' | 'detailed'>('net');
  const [netEntries, setNetEntries] = useState<EditablePayslipItem[]>([]);
  const [items, setItems] = useState<EditablePayslipItem[]>([]);
  const [onlyIncome, setOnlyIncome] = useState(true);
  const [repeatMonths, setRepeatMonths] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [receipt, setReceipt] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  const addItemButton = useRef<HTMLButtonElement>(null);
  const addedItem = useRef<string>();
  const id = useId();
  const busy = Boolean(reading || saving);

  useEffect(() => {
    if (!pdfFile) return;
    const url = URL.createObjectURL(pdfFile);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfFile]);

  useLayoutEffect(() => {
    heading.current?.focus();
  }, [step, receipt]);

  useLayoutEffect(() => {
    if (!addedItem.current) return;
    document.getElementById(id + '-description-' + addedItem.current)?.focus();
    addedItem.current = undefined;
  }, [id, items]);

  useEffect(() => {
    if (saveError) errorNotice.current?.scrollIntoView({ block: 'nearest' });
  }, [saveError]);

  function navigate(next: Step) {
    setPane('review');
    setSaveError('');
    setStep(next);
  }

  async function readPdf(file?: File) {
    if (!file || busy) return;
    setFileError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Selecione um arquivo no formato PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024 || file.size === 0) {
      setFileError(
        file.size
          ? 'O PDF excede o limite de 5 MB. Escolha um arquivo menor.'
          : 'O arquivo está vazio. Escolha outro PDF.',
      );
      return;
    }
    setReading(file.name);
    const failure = 'Não foi possível ler o PDF. Confira o arquivo e a conexão e tente novamente.';
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await requestApi<PayslipParseResult>('/payslip/parse', failure, {
        method: 'POST',
        body: form,
      });
      if (!data) throw new Error(failure);
      const hasAdvance = Boolean(data.hasAdvancePayment && (data.advanceAmount ?? 0) > 0);
      const reference = data.referenceMonth ? parseCalendarDate(data.referenceMonth + '-01') : undefined;
      const nextMonth = reference ? addMonths(reference, 1) : undefined;
      const balance: EditablePayslipItem = {
        tempId: 'balance',
        description: hasAdvance ? 'Saldo de Salário (5º dia útil)' : 'Salário Líquido',
        type: 'income',
        category: 'fixed',
        amount: data.netAmount || 0,
        selected: true,
        suggestedDate:
          data.netBalanceDate ||
          (nextMonth
            ? nextMonth.toISOString().slice(0, 7) + '-05'
            : ''),
      };
      const advance: EditablePayslipItem = {
        ...balance,
        tempId: 'advance',
        description: 'Adiantamento Salarial (Quinzena)',
        isAdvance: true,
        amount: data.advanceAmount || 0,
        suggestedDate: data.advanceDate || (data.referenceMonth ? data.referenceMonth + '-20' : ''),
      };
      setPdfFile(file);
      setParsed(data);
      setNetEntries(hasAdvance ? [advance, balance] : [balance]);
      setItems(
        (data.items || []).map((item) => ({
          ...item,
          tempId: item.tempId || crypto.randomUUID(),
          description: item.description || '',
          amount: Number(item.amount) || 0,
          category: item.suggestedCategory || 'fixed',
          currentInstallment: item.currentInstallment ?? 1,
          totalInstallments: item.totalInstallments ?? 1,
          selected: item.selected !== false,
        })),
      );
      setMode('net');
      setOnlyIncome(true);
      setRepeatMonths(1);
      navigate('Conferência');
    } catch {
      setFileError(failure);
    } finally {
      setReading('');
    }
  }

  const dataStep = step === 'Conferência' || step === 'Lançamentos';
  const advance = netEntries.find((item) => item.isAdvance);
  const balanceDate = netEntries.find((item) => !item.isAdvance)?.suggestedDate || '';
  const visible = onlyIncome ? items.filter((item) => item.type === 'income') : items;
  const checked = visible.filter((item) => item.selected).length;
  const selected = (mode === 'net' ? netEntries : items).filter((item) => item.selected);
  const itemDate = (item: EditablePayslipItem) => item.suggestedDate ?? balanceDate;
  const invalid = selected.find((item) => {
    const date = itemDate(item);
    return (
      !item.description.trim() ||
      !validAmount(item.amount) ||
      !calendarDateSchema.safeParse(date).success ||
      (item.category === 'installment' && !validInstallments(item)) ||
      addMonths(parseCalendarDate(date), transactionCount(item, repeatMonths) - 1).getUTCFullYear() > 9999
    );
  });
  const transactions: BatchItem[] = selected.map((item) => ({
    description: item.description.trim(),
    amount: toCents(item.amount) / 100,
    type: item.type,
    category: item.category,
    date: itemDate(item),
    status: 'pending',
    currentInstallment: item.category === 'installment' ? item.currentInstallment : undefined,
    totalInstallments: item.category === 'installment' ? item.totalInstallments : undefined,
  }));
  const total = transactions.reduce((sum, item) => sum + transactionCount(item, repeatMonths), 0);
  const issue = !selected.length
    ? 'Selecione pelo menos um lançamento.'
    : invalid
      ? 'Revise os campos destacados em “' + (invalid.description || 'Rubrica sem descrição') + '”.'
      : !activeProfile
        ? 'Selecione um perfil para registrar os lançamentos.'
        : '';

  function updateItem(id: string, change: Partial<EditablePayslipItem>) {
    const setter = mode === 'net' ? setNetEntries : setItems;
    setter((previous) =>
      previous.map((item) => (item.tempId === id ? { ...item, ...change } : item)),
    );
  }

  async function saveBatch() {
    if (step !== 'Confirmação' || saving || receipt || issue || !activeProfile) return;
    setSaving(true);
    setSaveError('');
    const failure = 'Não foi possível salvar os lançamentos do contracheque. Tente novamente.';
    try {
      const payload: BatchCreateTransactionDTO = {
        profileId: activeProfile.id,
        repeatMonths,
        transactions,
      };
      const result = await requestApi<{ totalCreated: number }>('/transactions/batch', failure, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created = result?.totalCreated ?? total;
      setReceipt(
        countEntries(created) +
          (created === 1 ? ' criado' : ' criados') +
          ' no perfil ' +
          activeProfile.name +
          '.',
      );
      await refreshTransactions(activeProfile.id);
      onSuccess?.();
    } catch {
      setSaveError(failure);
    } finally {
      setSaving(false);
    }
  }

  function projection() {
    return (
      <ul className="payslip-plan">
        {transactions.map((item, index) => {
          const count = transactionCount(item, repeatMonths);
          return (
            <li key={selected[index].tempId}>
              <div>
                <strong>{item.description}</strong>
                <small>
                  {item.category === 'installment'
                    ? 'Parcela ' + item.currentInstallment + ' de ' + item.totalInstallments + ' · '
                    : ''}
                  {count > 1 ? count + ' vezes · ' : ''}
                  {periodLabel(item.date, count)}
                </small>
                {count > 1 && (
                  <small>Primeira data · {calendarDate.format(parseCalendarDate(item.date))}</small>
                )}
              </div>
              <div className={'payslip-amount ' + item.type}>
                {item.type === 'expense' ? '−' : '+'}
                {currency.format(item.amount)}
                {count > 1 && <small>por lançamento</small>}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const titles: Record<Step, string> = {
    Arquivo: 'Selecionar o contracheque',
    Conferência: 'Conferir a leitura',
    Lançamentos: 'Preparar os lançamentos',
    Confirmação: 'Confirmar a importação',
  };

  return (
    <ModalLayer
      className="payslip-overlay"
      onDismiss={() => {
        if (!busy) onClose();
      }}
      aria-labelledby={id + '-title'}
    >
      <div className={'payslip-modal' + (dataStep ? ' split' : '')}>
        <header className="payslip-header">
          <div className="payslip-identity">
            <FileText size={22} aria-hidden="true" />
            <div>
              <h2 id={id + '-title'}>Importar contracheque</h2>
              <p>Perfil · {activeProfile?.name || 'Nenhum perfil selecionado'}</p>
            </div>
          </div>
          <button className="payslip-icon" aria-label="Fechar importação" aria-disabled={busy || undefined} onClick={() => {
            if (!busy) onClose();
          }}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <ol className="payslip-steps" aria-label="Etapas da importação">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === label ? 'step' : undefined}
              data-done={index < steps.indexOf(step) || !!receipt}
            >
              <span aria-hidden="true">
                {index < steps.indexOf(step) || receipt ? <Check size={13} /> : index + 1}
              </span>
              {label}
              {(index < steps.indexOf(step) || receipt) && <span className="sr-only"> concluída</span>}
            </li>
          ))}
        </ol>
        <input
          type="file"
          hidden
          accept=".pdf,application/pdf"
          ref={fileInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void readPdf(file);
          }}
        />

        {dataStep && (
          <div className="payslip-switch" role="group" aria-label="Área de visualização">
            <button aria-pressed={pane === 'review'} aria-controls={id + '-review'} onClick={() => setPane('review')}>
              <ClipboardList size={15} aria-hidden="true" /> Conferência
            </button>
            <button aria-pressed={pane === 'document'} aria-controls={id + '-document'} onClick={() => setPane('document')}>
              <FileText size={15} aria-hidden="true" /> Documento
            </button>
          </div>
        )}
        <div className="payslip-workspace" data-pane={pane}>
          {dataStep && (
            <aside className="payslip-document" id={id + '-document'} aria-label="Documento original">
              <div className="payslip-document-bar">
                <div>
                  <strong>Documento original</strong>
                  <p>{pdfFile?.name}</p>
                </div>
                <div className="payslip-document-actions">
                  <button onClick={() => navigate('Arquivo')}>Trocar PDF</button>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Abrir PDF em outra aba"
                    >
                      <ExternalLink size={15} /> Abrir
                    </a>
                  )}
                </div>
              </div>
              {pdfUrl && <iframe tabIndex={-1} title="Prévia do contracheque" src={pdfUrl + '#navpanes=0&view=FitH'} />}
            </aside>
          )}

          <section key={step} id={id + '-review'} className="payslip-panel">
            <div className="payslip-content">
              <h3 tabIndex={-1} ref={heading} data-initial-focus aria-describedby={receipt ? id + '-receipt' : undefined}>
                {receipt ? 'Importação concluída' : titles[step]}
              </h3>
              {step === 'Arquivo' && (
                <>
                  <p>
                    Escolha um PDF com texto selecionável. Você poderá conferir a leitura antes de
                    registrar os valores.
                  </p>
                  <button
                    className="payslip-drop"
                    data-dragging={dragging}
                    aria-disabled={Boolean(reading) || undefined}
                    aria-labelledby={id + '-pick'}
                    aria-describedby={id + '-format' + (fileError ? ' ' + id + '-file-error' : '')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      void readPdf(e.dataTransfer.files[0]);
                    }}
                    onClick={() => { if (!busy) fileInput.current?.click(); }}
                  >
                    {reading ? <Loader2 className="payslip-spin" aria-hidden="true" /> : <UploadCloud size={32} aria-hidden="true" />}
                    <strong id={id + '-pick'}>Selecionar PDF</strong>
                    <span>{reading || 'Ou arraste o arquivo para cá'}</span>
                    <small id={id + '-format'}>PDF com texto selecionável · Até 5 MB</small>
                  </button>
                  <p role="status">{reading ? 'Lendo ' + reading + ' para identificar valores e rubricas…' : ''}</p>
                  <p role="alert" id={id + '-file-error'} className="payslip-error">{fileError}</p>
                  {pdfFile && (
                    <p>
                      Arquivo atual · <strong>{pdfFile.name}</strong>
                    </p>
                  )}
                </>
              )}

              {step === 'Conferência' && parsed && (
                <>
                  <p>
                    Compare as sugestões com o PDF. Na próxima etapa, você pode ajustar valores,
                    rubricas e datas.
                  </p>
                  <div className="payslip-source">
                    <span role="status">
                      Competência{' '}
                      <strong>
                        {parsed.referenceMonth
                          ? month.format(parseCalendarDate(parsed.referenceMonth + '-01'))
                          : 'A conferir'}
                      </strong>
                    </span>
                    {parsed.employerName && (
                      <span className="payslip-employer" title={parsed.employerName}>
                        {parsed.employerName}
                      </span>
                    )}
                  </div>
                  <dl className="payslip-metrics">
                    <div>
                      <dt>Salário bruto</dt>
                      <dd>{currency.format(parsed.grossAmount)}</dd>
                    </div>
                    <div>
                      <dt>Descontos</dt>
                      <dd>{currency.format(parsed.totalDeductions)}</dd>
                    </div>
                    <div>
                      <dt>Saldo líquido</dt>
                      <dd>{currency.format(parsed.netAmount)}</dd>
                    </div>
                  </dl>
                  {(!parsed.referenceMonth || !parsed.netBalanceDate) && (
                    <Notice>Confira as datas de recebimento na etapa de lançamentos.</Notice>
                  )}
                  {(!validAmount(parsed.netAmount) ||
                    !validAmount(parsed.grossAmount) ||
                    Math.abs(
                      Math.round(
                        (parsed.grossAmount - parsed.totalDeductions - parsed.netAmount) * 100,
                      ),
                    ) > 1) && (
                    <Notice>
                      Confira os totais no PDF. Há um valor zerado ou uma diferença entre bruto,
                      descontos e líquido.
                    </Notice>
                  )}
                  {advance && (
                    <div className="payslip-callout">
                      <Wallet size={19} />
                      <div>
                        <h4>Adiantamento identificado</h4>
                        <p>
                          A quinzena de{' '}
                          <strong>{currency.format(parsed.advanceAmount || 0)}</strong> e o saldo de{' '}
                          <strong>{currency.format(parsed.netAmount)}</strong> somam{' '}
                          <strong>
                            {currency.format((parsed.advanceAmount || 0) + parsed.netAmount)}
                          </strong>
                          . Você pode registrar cada recebimento na sua data.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="payslip-section-title">
                    <h4>Rubricas identificadas</h4>
                    <span>{parsed.items.length}</span>
                  </div>
                  {parsed.items.length ? (
                    <ul className="payslip-plan">
                      {parsed.items.map((item, index) => (
                        <li key={item.tempId || index}>
                          <div>
                            <strong>{item.description || 'Descrição a conferir'}</strong>
                            <small>
                              {item.isAdvance
                                ? 'Adiantamento'
                                : item.type === 'expense'
                                  ? 'Desconto'
                                  : 'Receita'}
                              {item.reference && ' · Ref. ' + item.reference}
                            </small>
                          </div>
                          <span className={'payslip-amount ' + item.type}>
                            {validAmount(item.amount)
                              ? currency.format(item.amount)
                              : 'Revisar valor'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Notice>
                      A leitura não identificou rubricas. Você pode incluí-las manualmente na
                      próxima etapa.
                    </Notice>
                  )}
                </>
              )}

              {step === 'Lançamentos' && (
                <>
                  <div className="payslip-modes" role="group" aria-label="Forma de registro">
                    <button aria-pressed={mode === 'net'} onClick={() => setMode('net')}>
                      <Wallet size={18} />
                      <strong>Salário líquido</strong>
                      <small>
                        {advance
                          ? 'Quinzena e saldo, com datas próprias.'
                          : 'Uma receita pelo valor recebido.'}
                      </small>
                    </button>
                    <button aria-pressed={mode === 'detailed'} onClick={() => setMode('detailed')}>
                      <Layers size={18} />
                      <strong>Rubricas detalhadas</strong>
                      <small>Uma entrada ou um desconto por rubrica selecionada.</small>
                    </button>
                  </div>
                  <div className="payslip-section-title">
                    <h4>{mode === 'net' ? 'Recebimentos' : 'Editar rubricas'}</h4>
                    <span>
                      {countEntries(selected.length)}{' '}
                      {selected.length === 1 ? 'selecionado' : 'selecionados'}
                    </span>
                  </div>
                  {mode === 'detailed' && (
                    <div className="payslip-tools">
                      <Select
                        size="sm"
                        label="Mostrar rubricas"
                        value={onlyIncome ? 'income' : 'all'}
                        onChange={(e) => setOnlyIncome(e.target.value === 'income')}
                      >
                        <option value="income">
                          Apenas receitas ({items.filter((item) => item.type === 'income').length})
                        </option>
                        <option value="all">Todas as rubricas ({items.length})</option>
                      </Select>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!visible.length && checked === visible.length}
                          disabled={!visible.length}
                          ref={(el) => {
                            if (el) el.indeterminate = checked > 0 && checked < visible.length;
                          }}
                          onChange={(e) =>
                            setItems(
                              items.map((item) =>
                                !onlyIncome || item.type === 'income'
                                  ? { ...item, selected: e.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Selecionar visíveis ({checked}/{visible.length})
                      </label>
                    </div>
                  )}
                  {(mode === 'net' ? netEntries : visible).map((item) => {
                    const itemLabel = mode === 'net'
                      ? item.isAdvance ? 'Adiantamento (quinzena)' : 'Saldo líquido'
                      : item.description || 'Rubrica sem descrição';
                    const installmentError = item.selected && !validInstallments(item);
                    const installmentErrorId = id + '-installments-' + item.tempId;
                    return (
                    <article key={item.tempId} className="payslip-entry">
                      <div className="payslip-entry-head">
                        <label>
                          {(mode === 'detailed' || !!advance) && (
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                updateItem(item.tempId, { selected: e.target.checked })
                              }
                            />
                          )}
                          {itemLabel}
                        </label>
                        {mode === 'detailed' && (
                          <button
                            className="payslip-icon"
                            aria-label={'Remover ' + (item.description || 'rubrica')}
                            onClick={() => {
                              addItemButton.current?.focus();
                              setItems(items.filter((row) => row.tempId !== item.tempId));
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {mode === 'detailed' && (item.reference || item.isAdvance) && (
                        <p>
                          {[
                            item.isAdvance && 'Adiantamento',
                            item.reference && 'Ref. ' + item.reference,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <EntryFields
                        item={item}
                        date={itemDate(item)}
                        itemLabel={itemLabel}
                        descriptionId={id + '-description-' + item.tempId}
                        update={(change) => updateItem(item.tempId, change)}
                      />
                      {mode === 'detailed' && (
                        <fieldset className="payslip-fields" disabled={!item.selected}>
                          <legend className="sr-only">Classificação de {itemLabel}</legend>
                          <Select
                            label="Tipo"
                            size="sm"
                            value={item.type}
                            onChange={(e) =>
                              updateItem(item.tempId, { type: e.target.value as TransactionType })
                            }
                          >
                            <option value="income">Receita</option>
                            <option value="expense">Desconto</option>
                          </Select>
                          <Select
                            label="Categoria"
                            size="sm"
                            value={item.category}
                            onChange={(e) =>
                              updateItem(item.tempId, {
                                category: e.target.value as TransactionCategory,
                                currentInstallment: item.currentInstallment ?? 1,
                                totalInstallments: item.totalInstallments ?? 1,
                              })
                            }
                          >
                            <option value="fixed">Fixa</option>
                            <option value="recurring">Recorrente</option>
                            <option value="installment">Parcelada</option>
                            <option value="daily">Cotidiana</option>
                          </Select>
                          {item.category === 'installment' && (
                            <>
                              <Input
                                label="Parcela atual"
                                type="number"
                                min={1}
                                size="sm"
                                value={item.currentInstallment || ''}
                                hasError={installmentError}
                                aria-describedby={installmentError ? installmentErrorId : undefined}
                                onChange={(e) =>
                                  updateItem(item.tempId, {
                                    currentInstallment: e.target.valueAsNumber || 0,
                                  })
                                }
                              />
                              <Input
                                label="Total de parcelas"
                                type="number"
                                min={item.currentInstallment || 1}
                                max={MAX_SERIES_LENGTH}
                                size="sm"
                                value={item.totalInstallments || ''}
                                hasError={installmentError}
                                aria-describedby={installmentError ? installmentErrorId : undefined}
                                onChange={(e) =>
                                  updateItem(item.tempId, {
                                    totalInstallments: e.target.valueAsNumber || 0,
                                  })
                                }
                              />
                              {installmentError && <p id={installmentErrorId} className="payslip-error wide">
                                Informe uma parcela atual entre 1 e o total, limitado a {MAX_SERIES_LENGTH} parcelas.
                              </p>}
                            </>
                          )}
                        </fieldset>
                      )}
                    </article>
                    );
                  })}
                  {mode === 'detailed' && (
                    <>
                      {!visible.length && <p>Nenhuma rubrica neste filtro.</p>}
                      <Button
                        variant="outline"
                        className="payslip-add"
                        ref={addItemButton}
                        onClick={() => {
                          const tempId = crypto.randomUUID();
                          addedItem.current = tempId;
                          setItems([
                            ...items,
                            {
                              tempId,
                              description: '',
                              amount: 0,
                              type: 'income',
                              category: 'fixed',
                              selected: true,
                            },
                          ]);
                        }}
                      >
                        <Plus size={16} />
                        Adicionar rubrica manual
                      </Button>
                    </>
                  )}
                  <div className="payslip-repeat">
                    <CalendarDays size={20} />
                    <div>
                      <Select
                        label="Repetição de fixos e recorrentes"
                        aria-describedby={id + '-repeat'}
                        value={repeatMonths}
                        onChange={(e) => setRepeatMonths(Number(e.target.value))}
                      >
                        <option value={1}>Somente no mês de cada lançamento</option>
                        <option value={6}>Por 6 meses</option>
                        <option value={12}>Por 12 meses</option>
                      </Select>
                      <p id={id + '-repeat'}>
                        As parcelas seguem da atual até a última. Itens cotidianos entram uma vez.
                      </p>
                    </div>
                  </div>
                  {issue ? (
                    <Notice id={id + '-issue'}>
                      {issue}{' '}
                      {invalid &&
                        onlyIncome &&
                        mode === 'detailed' &&
                        invalid.type === 'expense' && (
                          <button type="button" onClick={() => {
                            addItemButton.current?.focus();
                            setOnlyIncome(false);
                          }}>
                            Mostrar todas as rubricas
                          </button>
                        )}
                    </Notice>
                  ) : (
                    <details className="payslip-details">
                      <summary>Prévia da repetição · {countEntries(total)}</summary>
                      {projection()}
                    </details>
                  )}
                </>
              )}

              {step === 'Confirmação' &&
                (receipt ? (
                  <div className="payslip-callout">
                    <CircleCheck size={22} aria-hidden="true" />
                    <strong id={id + '-receipt'}>{receipt}</strong>
                  </div>
                ) : (
                  <>
                    <p>
                      Confira os valores e os meses antes de gravar no perfil{' '}
                      <strong>{activeProfile?.name}</strong>.
                    </p>
                    <div className="payslip-summary">
                      <small>{mode === 'net' ? 'Salário líquido' : 'Rubricas detalhadas'}</small>
                      <strong>{countEntries(total)}</strong>
                      <span>
                        {selected.length}{' '}
                        {selected.length === 1 ? 'item selecionado' : 'itens selecionados'} · Status
                        pendente
                      </span>
                    </div>
                    <h4>Lançamentos por período</h4>
                    {projection()}
                  </>
                ))}
              <p ref={errorNotice} role="alert" className="payslip-error">{saveError}</p>
              <p role="status">{saving && !receipt ? 'Registrando os lançamentos do contracheque…' : ''}</p>
            </div>
          </section>
        </div>
        <footer className="payslip-footer">
          {receipt ? (
            <Button onClick={onClose} disabled={saving}>
              Concluir
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  step === 'Arquivo' ? onClose() : navigate(steps[steps.indexOf(step) - 1])
                }
              >
                {step !== 'Arquivo' && <ArrowLeft size={15} />}
                {step === 'Arquivo' ? 'Cancelar' : 'Voltar'}
              </Button>
              {(step !== 'Arquivo' || !!pdfFile) && (
                <Button
                  aria-disabled={busy || ((step === 'Lançamentos' || step === 'Confirmação') && Boolean(issue)) || undefined}
                  aria-describedby={step === 'Lançamentos' && issue ? id + '-issue' : undefined}
                  onClick={() => {
                    if (busy || ((step === 'Lançamentos' || step === 'Confirmação') && issue)) return;
                    if (step === 'Confirmação') void saveBatch();
                    else navigate(steps[steps.indexOf(step) + 1]);
                  }}
                >
                  {saving && <Loader2 size={16} className="payslip-spin" />}
                  {step === 'Lançamentos'
                    ? 'Revisar importação'
                    : step === 'Confirmação'
                      ? saving
                        ? 'Registrando…'
                        : 'Confirmar e registrar'
                      : step === 'Arquivo'
                        ? 'Usar PDF atual'
                        : 'Escolher lançamentos'}
                  {!saving &&
                    (step === 'Confirmação' ? <Check size={16} /> : <ArrowRight size={16} />)}
                </Button>
              )}
            </>
          )}
        </footer>
      </div>
    </ModalLayer>
  );
}

export function PayslipImportModal({ isOpen, ...props }: PayslipImportModalProps) {
  return isOpen ? <ImportSession {...props} /> : null;
}

export default PayslipImportModal;
