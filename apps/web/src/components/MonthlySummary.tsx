import type { Transaction } from '@organizador/shared';
import { toCents } from '@organizador/shared';
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from 'lucide-react';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatCurrency = (value: number) => brl.format(value);

export function formatCurrencyCents(cents: bigint) {
  const units = cents / 100n;
  const fraction = ((cents < 0n ? -cents : cents) % 100n).toString().padStart(2, '0');
  return brl.formatToParts(cents < 0n && units === 0n ? -0 : units)
    .map(part => part.type === 'fraction' ? fraction : part.value)
    .join('');
}

function balanceLabel(value: number) {
  return value > 0 ? 'Superávit' : value < 0 ? 'Déficit' : 'Equilíbrio';
}

export function MonthlySummary({ transactions, unavailableReason }: { transactions: Transaction[]; unavailableReason?: string }) {
  const income = { total: 0, paid: 0 };
  const expense = { total: 0, paid: 0 };
  const groups = [
    { label: 'Fixas e cotidianas', total: 0, paid: 0 },
    { label: 'Parceladas e recorrentes', total: 0, paid: 0 },
  ];

  for (const tx of transactions) {
    const amount = toCents(tx.amount || 0);
    const paid = tx.status === 'paid' ? amount : 0;
    const flow = tx.type === 'income' ? income : expense;
    flow.total += amount;
    flow.paid += paid;
    if (tx.type === 'expense') {
      const group = tx.category === 'fixed' || tx.category === 'daily' ? groups[0] : groups[1];
      group.total += amount;
      group.paid += paid;
    }
  }

  const money = (cents: number) => unavailableReason ? '—' : formatCurrency(cents / 100);
  const projected = income.total - expense.total;
  const realized = income.paid - expense.paid;
  const pendingIncome = income.total - income.paid;
  const pendingExpense = expense.total - expense.paid;

  return (
    <section className="monthly-statement" data-wide={Math.max(income.total, expense.total) >= 1_000_000_000 || undefined} aria-label="Resumo financeiro do mês">
      <div className="statement-main">
        <div className="monthly-result">
          <h2>Resultado previsto do mês</h2>
          <p className="result-amount">{money(projected)}</p>
          {!unavailableReason && <p className="balance-label">{balanceLabel(projected)}</p>}
          <p className="result-definition">Entradas menos saídas lançadas no período.</p>
          {unavailableReason && <p className="result-definition">{unavailableReason}</p>}
          <div className="realized-result">
            <span>Resultado realizado <small>Recebido menos pago</small></span>
            <strong>{money(realized)}{!unavailableReason && <small>{balanceLabel(realized)}</small>}</strong>
          </div>
        </div>

        <div className="monthly-flows">
          {[
            { label: 'Entradas previstas', icon: ArrowDownLeft, amount: income, settled: 'Recebido', open: 'A receber' },
            { label: 'Saídas previstas', icon: ArrowUpRight, amount: expense, settled: 'Pago', open: 'A pagar' },
          ].map(({ label, icon: Icon, amount, settled, open }) => (
            <div className="flow" key={label}>
              <h3><Icon size={18} aria-hidden="true" />{label}</h3>
              <p className="flow-amount">{money(amount.total)}</p>
              <dl>
                <div><dt>{settled}</dt><dd>{money(amount.paid)}</dd></div>
                <div><dt>{open}</dt><dd>{money(amount.total - amount.paid)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </div>

      <details className="expense-breakdown">
        <summary><ChevronDown size={16} aria-hidden="true" />Detalhar despesas e diferença em aberto</summary>
        <div className="breakdown-content">
          <table role="table" aria-label="Composição das despesas">
            <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Despesas</th><th role="columnheader" scope="col">Previsto</th><th role="columnheader" scope="col">Pago</th><th role="columnheader" scope="col">A pagar</th></tr></thead>
            <tbody role="rowgroup">{groups.map(({ label, total, paid }) => (
              <tr key={label} role="row">
                <th role="rowheader" scope="row">{label}</th>
                <td role="cell"><span className="breakdown-label" aria-hidden="true">Previsto</span>{money(total)}</td>
                <td role="cell"><span className="breakdown-label" aria-hidden="true">Pago</span>{money(paid)}</td>
                <td role="cell"><span className="breakdown-label" aria-hidden="true">A pagar</span>{money(total - paid)}</td>
              </tr>
            ))}</tbody>
          </table>
          <p>Diferença em aberto <span>(a receber menos a pagar)</span> <strong>{money(pendingIncome - pendingExpense)}</strong></p>
        </div>
      </details>
    </section>
  );
}
