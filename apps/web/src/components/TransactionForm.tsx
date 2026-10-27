import React, { useState } from 'react';
import { useTransactions } from '../contexts/TransactionContext';
import { Button, Input } from './ui';
import type { TransactionType, TransactionCategory, CreateTransactionDTO } from '@organizador/shared';
import { Calculator, PlusCircle, AlertCircle } from 'lucide-react';

export interface TransactionFormProps {
  onSuccess?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onSuccess }) => {
  const { addTransaction, isLoading } = useTransactions();

  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('installment');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('2');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Cálculos dinâmicos em tempo real para parcelamento
  const parsedInstallments = parseInt(installments, 10) || 0;
  const parsedInstallmentAmount = parseFloat(installmentAmount.replace(',', '.')) || 0;
  const totalDebt = parsedInstallments * parsedInstallmentAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) {
      setFormError('Por favor, informe a descrição da transação.');
      return;
    }

    const finalAmount = category === 'installment'
      ? parsedInstallmentAmount
      : parseFloat(amount.replace(',', '.')) || 0;

    if (finalAmount <= 0) {
      setFormError('O valor deve ser maior que zero.');
      return;
    }

    if (category === 'installment') {
      if (parsedInstallments < 1) {
        setFormError('A quantidade de parcelas deve ser de no mínimo 1.');
        return;
      }
    }

    const payload: CreateTransactionDTO = {
      type,
      category,
      description: description.trim(),
      amount: finalAmount,
      date,
      currentInstallment: category === 'installment' ? 1 : undefined,
      totalInstallments: category === 'installment' ? parsedInstallments : undefined,
      status: 'pending',
    };

    try {
      await addTransaction(payload);

      // Limpa os campos após o cadastro com sucesso
      setDescription('');
      setAmount('');
      setInstallmentAmount('');
      setInstallments('2');
      setFormError(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar transação.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Alerta de Erro de Validação */}
      {formError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{formError}</span>
        </div>
      )}

      {/* Seleção do Tipo: Despesa ou Receita */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#334155',
            marginBottom: '0.375rem',
          }}
        >
          Tipo de Transação
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            type="button"
            variant={type === 'expense' ? 'danger' : 'ghost'}
            onClick={() => {
              setType('expense');
            }}
            style={{ flex: 1 }}
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
            style={{ flex: 1 }}
          >
            Receita
          </Button>
        </div>
      </div>

      {/* Descrição */}
      <Input
        label="Descrição"
        placeholder="Ex: Compra do Mês, Monitor 4K, Salário..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      {/* Categoria */}
      <div>
        <label
          htmlFor="transaction-category"
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#334155',
            marginBottom: '0.375rem',
          }}
        >
          Categoria
        </label>
        <select
          id="transaction-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as TransactionCategory)}
          style={{
            width: '100%',
            height: '2.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '0 0.75rem',
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        >
          {type === 'expense' && (
            <option value="installment">Parcelada (Cartão, Empréstimo, Financiamento)</option>
          )}
          <option value="fixed">Fixa (Aluguel, Salário, Internet, Condomínio)</option>
          <option value="recurring">Recorrente (Streaming, Assinaturas)</option>
          <option value="daily">Cotidiana / Variável (Alimentação, Lazer, Extra)</option>
        </select>
      </div>

      {/* Comportamento dinâmico: Renderização condicional suave de parcelamento */}
      {category === 'installment' && type === 'expense' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: '0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            animation: 'fadeInInstallments 0.25s ease-out forwards',
          }}
        >
          <style>{`
            @keyframes fadeInInstallments {
              from { opacity: 0; transform: translateY(-6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <Input
              label="Quantidade de Parcelas"
              type="number"
              min="1"
              max="120"
              placeholder="Ex: 10"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              required
            />

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
          </div>

          {/* Helper Text em tempo real com o valor total da dívida */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              backgroundColor: '#eef2ff',
              border: '1px solid #c7d2fe',
              color: '#3730a3',
              fontSize: '0.8125rem',
            }}
          >
            <Calculator size={18} style={{ flexShrink: 0, color: '#4f46e5' }} />
            <span>
              Total da dívida:{' '}
              <strong style={{ fontSize: '0.875rem', color: '#312e81' }}>
                R$ {totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>{' '}
              ({parsedInstallments}x de R${' '}
              {parsedInstallmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
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

      {/* Data */}
      <Input
        label="Data de Vencimento / Competência"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      {/* Botão de Envio */}
      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        style={{
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <PlusCircle size={18} />
        {isLoading ? 'Salvando...' : 'Adicionar Transação'}
      </Button>
    </form>
  );
};
