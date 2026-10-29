import React, { useState, useEffect } from 'react';
import { useTransactions } from '../contexts/TransactionContext';
import { Button, Input, Select } from './ui';
import type {
  Transaction,
  TransactionType,
  TransactionCategory,
  CreateTransactionDTO,
  UpdateTransactionDTO,
} from '@organizador/shared';
import { css } from '@/styled-system/css';
import { Calculator, PlusCircle, Check, AlertCircle, RotateCcw, CreditCard } from 'lucide-react';

export interface TransactionFormProps {
  initialData?: Transaction;
  fixedType?: TransactionType;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Estilos Panda CSS para substituir todos os inline styles
const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
});

const errorAlertStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  p: '3',
  borderRadius: 'lg',
  backgroundColor: 'expense.50',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'expense.200',
  color: 'expense.700',
  fontSize: 'sm',
  animation: 'fadeIn 0.2s ease-out forwards',
});

const fieldContainerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
});

const fieldLabelStyle = css({
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'slate.700',
});

const buttonGroupStyle = css({
  display: 'flex',
  gap: '2',
});

const installmentBoxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  p: '4',
  borderRadius: 'xl',
  backgroundColor: 'slate.50',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  animation: 'fadeIn 0.25s ease-out forwards',
});

const installmentModeContainerStyle = css({
  display: 'flex',
  borderRadius: 'lg',
  backgroundColor: 'slate.200',
  p: '1',
  gap: '1',
});

const installmentGridStyle = css({
  display: 'grid',
  gridTemplateColumns: {
    base: '1fr',
    sm: 'repeat(2, 1fr)',
  },
  gap: '3',
});

const summaryCardStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '2.5',
  p: '3',
  borderRadius: 'lg',
  backgroundColor: 'brand.50',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'brand.100',
  color: 'brand.700',
  fontSize: 'xs',
  lineHeight: '1.4',
});

const summaryIconStyle = css({
  flexShrink: 0,
  color: 'brand.600',
  mt: '0.5',
});

const summaryStrongStyle = css({
  fontSize: 'sm',
  fontWeight: 'bold',
  color: 'brand.700',
});

const actionsGroupStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  mt: '2',
});

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialData,
  fixedType,
  onSuccess,
  onCancel,
}) => {
  const { addTransaction, updateTransaction, isLoading } = useTransactions();
  const isEditing = Boolean(initialData);

  const effectiveType = fixedType || (initialData ? initialData.type : 'expense');

  // Estados fundamentais da transação
  const [type, setType] = useState<TransactionType>(effectiveType);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TransactionCategory>(
    effectiveType === 'expense' ? 'installment' : 'fixed'
  );
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados específicos para categoria 'installment' (parcelamento)
  const [installmentMode, setInstallmentMode] = useState<'by_installment' | 'by_total'>('by_installment');
  const [installments, setInstallments] = useState('2');
  const [currentInstallment, setCurrentInstallment] = useState('1');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Sincroniza o estado do formulário sempre que initialData mudar (Modo Edição)
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setDescription(initialData.description || '');
      setCategory(initialData.category);
      setDate(
        initialData.date
          ? initialData.date.split('T')[0]
          : new Date().toISOString().split('T')[0]
      );

      if (initialData.category === 'installment') {
        const total = initialData.totalInstallments ? String(initialData.totalInstallments) : '1';
        const current = initialData.currentInstallment ? String(initialData.currentInstallment) : '1';
        const instVal = initialData.amount ? String(initialData.amount) : '';

        setInstallments(total);
        setCurrentInstallment(current);
        setInstallmentAmount(instVal);
        const calculatedTotal = (Number(total) * Number(instVal || 0)).toFixed(2);
        setTotalAmount(calculatedTotal);
        setInstallmentMode('by_installment');
      } else {
        setAmount(initialData.amount ? String(initialData.amount) : '');
      }
      setFormError(null);
    } else if (fixedType) {
      setType(fixedType);
      setCategory(fixedType === 'expense' ? 'installment' : 'fixed');
    }
  }, [initialData, fixedType]);

  // Cálculos matemáticos em tempo real para parcelamento
  const parsedInstallments = Math.max(1, parseInt(installments, 10) || 1);
  const parsedCurrentInstallment = Math.max(1, parseInt(currentInstallment, 10) || 1);

  // Valor unitário de cada parcela conforme o modo de entrada escolhido
  let calculatedInstallmentAmount = 0;
  let calculatedTotalDebt = 0;

  if (installmentMode === 'by_installment') {
    calculatedInstallmentAmount = parseFloat(installmentAmount.replace(',', '.')) || 0;
    calculatedTotalDebt = parsedInstallments * calculatedInstallmentAmount;
  } else {
    calculatedTotalDebt = parseFloat(totalAmount.replace(',', '.')) || 0;
    calculatedInstallmentAmount =
      parsedInstallments > 0 ? calculatedTotalDebt / parsedInstallments : 0;
  }

  // Parcelas restantes a liquidar considerando o andamento atual (ex: 4 de 10)
  const remainingInstallmentsCount =
    parsedCurrentInstallment <= parsedInstallments
      ? parsedInstallments - parsedCurrentInstallment + 1
      : 1;
  const remainingTotalDebt = remainingInstallmentsCount * calculatedInstallmentAmount;

  // Alternância suave entre os modos de valor no parcelamento
  const handleModeChange = (mode: 'by_installment' | 'by_total') => {
    setInstallmentMode(mode);
    if (mode === 'by_total' && calculatedInstallmentAmount > 0 && !totalAmount) {
      setTotalAmount(calculatedTotalDebt.toFixed(2));
    } else if (mode === 'by_installment' && calculatedTotalDebt > 0 && !installmentAmount) {
      setInstallmentAmount(calculatedInstallmentAmount.toFixed(2));
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setInstallmentAmount('');
    setTotalAmount('');
    setInstallments('2');
    setCurrentInstallment('1');
    setInstallmentMode('by_installment');
    if (fixedType) {
      setType(fixedType);
      setCategory(fixedType === 'expense' ? 'installment' : 'fixed');
    }
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) {
      setFormError('Por favor, informe a descrição da transação.');
      return;
    }

    let finalAmount = 0;

    if (category === 'installment') {
      if (parsedInstallments < 1) {
        setFormError('A quantidade total de parcelas deve ser de no mínimo 1.');
        return;
      }

      if (parsedCurrentInstallment < 1) {
        setFormError('A parcela atual deve ser no mínimo 1.');
        return;
      }

      if (parsedCurrentInstallment > parsedInstallments) {
        setFormError(
          `A parcela atual (${parsedCurrentInstallment}) não pode ser maior que o total de parcelas (${parsedInstallments}).`
        );
        return;
      }

      finalAmount = Math.round(calculatedInstallmentAmount * 100) / 100;
      if (finalAmount <= 0) {
        setFormError('O valor da parcela deve ser maior que zero.');
        return;
      }
    } else {
      finalAmount = parseFloat(amount.replace(',', '.')) || 0;
      if (finalAmount <= 0) {
        setFormError('O valor deve ser maior que zero.');
        return;
      }
    }

    try {
      if (isEditing && initialData) {
        // MODO EDIÇÃO: Atualiza a transação existente
        const updatePayload: UpdateTransactionDTO = {
          type,
          category,
          description: description.trim(),
          amount: finalAmount,
          date,
          currentInstallment: category === 'installment' ? parsedCurrentInstallment : undefined,
          totalInstallments: category === 'installment' ? parsedInstallments : undefined,
        };

        await updateTransaction(initialData.id, updatePayload);
      } else {
        // MODO CRIAÇÃO: Adiciona uma nova transação
        const createPayload: CreateTransactionDTO = {
          type,
          category,
          description: description.trim(),
          amount: finalAmount,
          date,
          currentInstallment: category === 'installment' ? parsedCurrentInstallment : undefined,
          totalInstallments: category === 'installment' ? parsedInstallments : undefined,
          status: 'pending',
        };

        await addTransaction(createPayload);
        resetForm();
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar transação.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={formStyle}>
      {/* Alerta de Validação com Panda CSS */}
      {formError && (
        <div className={errorAlertStyle} role="alert">
          <AlertCircle size={18} className={css({ flexShrink: 0 })} />
          <span>{formError}</span>
        </div>
      )}

      {/* Tipo de Transação (exibido apenas quando fixedType não for definido) */}
      {!fixedType && (
        <div className={fieldContainerStyle}>
          <label className={fieldLabelStyle}>Tipo de Transação</label>
          <div className={buttonGroupStyle}>
            <Button
              type="button"
              variant={type === 'expense' ? 'danger' : 'ghost'}
              onClick={() => {
                setType('expense');
                if (category === 'fixed') {
                  setCategory('installment');
                }
              }}
              className={css({ flex: 1 })}
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={type === 'income' ? 'primary' : 'ghost'}
              onClick={() => {
                setType('income');
                if (category === 'installment') {
                  setCategory('fixed');
                }
              }}
              className={css({ flex: 1 })}
            >
              Receita
            </Button>
          </div>
        </div>
      )}

      {/* Descrição da Transação */}
      <Input
        label="Descrição"
        placeholder={
          type === 'income'
            ? 'Ex: Salário Mensal, Freelance, Rendimentos...'
            : 'Ex: Compra do Mês, Monitor 4K, Aluguel...'
        }
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      {/* Componente Select padronizado para Categoria */}
      <Select
        label="Categoria"
        value={category}
        onChange={(e) => setCategory(e.target.value as TransactionCategory)}
      >
        {type === 'expense' ? (
          <>
            <option value="installment">Parcelada (Cartão, Empréstimo, Financiamento)</option>
            <option value="fixed">Fixa (Aluguel, Internet, Condomínio)</option>
            <option value="recurring">Recorrente (Streaming, Assinaturas)</option>
            <option value="daily">Cotidiana / Variável (Alimentação, Lazer, Extra)</option>
          </>
        ) : (
          <>
            <option value="fixed">Fixa (Salário, Pró-labore, Pensão)</option>
            <option value="recurring">Recorrente (Rendimentos, Aluguel Recebido)</option>
            <option value="daily">Cotidiana / Extra (Freelance, Bônus, Vendas)</option>
          </>
        )}
      </Select>

      {/* Bloco Refatorado de Parcelamento */}
      {category === 'installment' && type === 'expense' ? (
        <div className={installmentBoxStyle}>
          {/* Seletor de Modo de Valor: Por Parcela vs Por Valor Total */}
          <div className={fieldContainerStyle}>
            <label className={fieldLabelStyle}>Como deseja informar o valor?</label>
            <div className={installmentModeContainerStyle}>
              <Button
                type="button"
                size="sm"
                variant={installmentMode === 'by_installment' ? 'primary' : 'ghost'}
                onClick={() => handleModeChange('by_installment')}
                className={css({ flex: 1, fontSize: 'xs' })}
              >
                Valor da Parcela
              </Button>
              <Button
                type="button"
                size="sm"
                variant={installmentMode === 'by_total' ? 'primary' : 'ghost'}
                onClick={() => handleModeChange('by_total')}
                className={css({ flex: 1, fontSize: 'xs' })}
              >
                Valor Total da Compra
              </Button>
            </div>
          </div>

          {/* Grid de Inputs de Parcela e Andamento da Dívida */}
          <div className={installmentGridStyle}>
            <Input
              label="Parcela Atual"
              type="number"
              min="1"
              max={installments || '120'}
              placeholder="Ex: 4"
              value={currentInstallment}
              onChange={(e) => setCurrentInstallment(e.target.value)}
              required
            />

            <Input
              label="Total de Parcelas"
              type="number"
              min="1"
              max="120"
              placeholder="Ex: 10"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              required
            />
          </div>

          {/* Input do Valor conforme o modo escolhido */}
          {installmentMode === 'by_installment' ? (
            <Input
              label="Valor de cada Parcela (R$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value)}
              required
            />
          ) : (
            <Input
              label="Valor Total da Compra (R$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
          )}

          {/* Helper Card com Cálculo e Resumo em Tempo Real */}
          <div className={summaryCardStyle}>
            <Calculator size={18} className={summaryIconStyle} />
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
              <div>
                Valor por Parcela:{' '}
                <strong className={summaryStrongStyle}>
                  R${' '}
                  {calculatedInstallmentAmount.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>{' '}
                ({parsedInstallments}x de R${' '}
                {calculatedInstallmentAmount.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                )
              </div>
              <div>
                Total da Compra:{' '}
                <strong className={summaryStrongStyle}>
                  R${' '}
                  {calculatedTotalDebt.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
              {parsedCurrentInstallment > 1 && (
                <div className={css({ color: 'brand.600', fontWeight: 'medium', mt: '1' })}>
                  <CreditCard size={14} className={css({ display: 'inline', mr: '1', verticalAlign: 'text-bottom' })} />
                  Dívida em andamento: na parcela {parsedCurrentInstallment} de {parsedInstallments}.
                  Restam <strong>{remainingInstallmentsCount}</strong> parcelas a pagar (R${' '}
                  {remainingTotalDebt.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  ).
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Input padrão de valor quando não é parcelado */
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      )}

      {/* Data de Vencimento ou Recebimento */}
      <Input
        label={type === 'income' ? 'Data de Recebimento' : 'Data de Vencimento / Competência'}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      {/* Ações do Formulário */}
      <div className={actionsGroupStyle}>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          className={css({
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            backgroundColor: type === 'income' ? 'income.600' : 'brand.600',
            _hover: {
              backgroundColor: type === 'income' ? 'income.700' : 'brand.700',
            },
          })}
        >
          {isEditing ? <Check size={18} /> : <PlusCircle size={18} />}
          {isLoading
            ? 'Salvando...'
            : isEditing
            ? 'Salvar Alterações'
            : type === 'income'
            ? 'Adicionar Receita'
            : 'Adicionar Dívida'}
        </Button>

        {isEditing && onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}
          >
            <RotateCcw size={16} />
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
};
