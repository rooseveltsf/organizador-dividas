import React, { useState } from 'react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui';
import type { Transaction, TransactionType, TransactionCategory } from '@organizador/shared';

export function App() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<TransactionCategory>('installment');
  const [installments, setInstallments] = useState('3');
  const [transactions, setTransactions] = useState<Partial<Transaction>[]>([
    {
      id: '1',
      description: 'Salário Mensal',
      amount: 5400,
      type: 'income',
      category: 'fixed',
      date: '2026-10-05',
    },
    {
      id: '2',
      description: 'Notebook Dell (Parcela 1/10)',
      amount: 450,
      type: 'expense',
      category: 'installment',
      currentInstallment: 1,
      totalInstallments: 10,
      date: '2026-10-15',
    },
  ]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newTx: Partial<Transaction> = {
      id: String(Date.now()),
      description,
      amount: parseFloat(amount),
      type,
      category,
      currentInstallment: category === 'installment' ? 1 : undefined,
      totalInstallments: category === 'installment' ? parseInt(installments, 10) : undefined,
      date: new Date().toISOString().split('T')[0],
    };

    setTransactions([newTx, ...transactions]);
    setDescription('');
    setAmount('');
  };

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Organizador de Dívidas
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Painel de controle financeiro e gestão de parcelamentos
        </p>
      </header>

      {/* Cards de Resumo Financeiro */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Receitas do Mês</CardDescription>
            <CardTitle style={{ color: '#10b981', fontSize: '1.5rem' }}>
              R$ {totalIncome.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Despesas e Parcelas</CardDescription>
            <CardTitle style={{ color: '#ef4444', fontSize: '1.5rem' }}>
              R$ {totalExpense.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Saldo Previsto</CardDescription>
            <CardTitle
              style={{
                color: balance >= 0 ? '#10b981' : '#ef4444',
                fontSize: '1.5rem',
              }}
            >
              R$ {balance.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Formulário de Nova Transação */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Nova Transação</CardTitle>
            <CardDescription>Cadastre entradas ou despesas parceladas</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                label="Descrição"
                placeholder="Ex: Compra do Mês, Monitor..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <Input
                label="Valor (R$)"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  type="button"
                  variant={type === 'expense' ? 'danger' : 'ghost'}
                  onClick={() => setType('expense')}
                  style={{ flex: 1 }}
                >
                  Despesa
                </Button>
                <Button
                  type="button"
                  variant={type === 'income' ? 'primary' : 'ghost'}
                  onClick={() => setType('income')}
                  style={{ flex: 1 }}
                >
                  Receita
                </Button>
              </div>

              {type === 'expense' && (
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
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                    style={{
                      width: '100%',
                      height: '2.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0',
                      padding: '0 0.75rem',
                      outline: 'none',
                    }}
                  >
                    <option value="installment">Parcelada (Installment)</option>
                    <option value="fixed">Fixa (Fixed)</option>
                    <option value="recurring">Recorrente (Recurring)</option>
                    <option value="daily">Cotidiana (Daily)</option>
                  </select>
                </div>
              )}

              {category === 'installment' && type === 'expense' && (
                <Input
                  label="Total de Parcelas"
                  type="number"
                  min="1"
                  max="120"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              )}

              <Button type="submit" variant="primary" style={{ marginTop: '0.5rem' }}>
                Adicionar Transação
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Transações */}
        <Card variant="outline">
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
            <CardDescription>Acompanhe suas receitas e compromissos</CardDescription>
          </CardHeader>

          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.875rem' }}>
                      {tx.description}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {tx.category === 'installment'
                        ? `Parcela ${tx.currentInstallment}/${tx.totalInstallments}`
                        : tx.category}{' '}
                      • {tx.date}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: tx.type === 'income' ? '#10b981' : '#ef4444',
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'} R$ {(tx.amount || 0).toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTransactions(transactions.filter((t) => t.id !== tx.id))}
                      style={{ color: '#ef4444', padding: '0 0.5rem' }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Total de itens: {transactions.length}
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default App;
