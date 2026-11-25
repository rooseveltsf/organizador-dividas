import { createContext, useContext, useState, useLayoutEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import type { Transaction, CreateTransactionDTO, UpdateTransactionInput, PaymentStatus } from '@organizador/shared';
import { requestApi } from '../api';
import { useProfiles } from './ProfileContext';

type RowOperation = 'save' | 'status' | 'delete';
type MonthScope = { profileId: string; month: number; year: number };
type MonthData = {
  scope: MonthScope;
  rows: Transaction[] | null;
  loading: boolean;
  error: string | null;
};

const loadErrorMessage = 'Não foi possível carregar os lançamentos deste mês.';

export interface TransactionContextData {
  transactions: Transaction[];
  hasMonthData: boolean;
  loadError: string | null;
  isLoading: boolean;
  pendingRows: ReadonlyMap<string, RowOperation>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setSelectedDate: (month: number, year: number) => void;
  fetchTransactions: (month?: number, year?: number) => Promise<void>;
  refreshTransactions: (profileId: string) => Promise<void>;
  addTransaction: (data: CreateTransactionDTO) => Promise<void>;
  updateTransaction: (id: string, data: UpdateTransactionInput) => Promise<void>;
  toggleTransactionStatus: (id: string, newStatus?: PaymentStatus) => Promise<void>;
  deleteTransaction: (id: string, deleteAllGroup?: boolean) => Promise<void>;
}

export const TransactionContext = createContext<TransactionContextData | undefined>(undefined);

function currentMonth(profileId: string | undefined) {
  const today = new Date();
  return { profileId, month: today.getMonth() + 1, year: today.getFullYear() };
}

export function TransactionProvider({ children }: { children: ReactNode }) {
  const profileId = useProfiles().activeProfile?.id;
  const [selection, setSelection] = useState(() => currentMonth(profileId));
  if (selection.profileId !== profileId) setSelection(currentMonth(profileId));

  const { month: selectedMonth, year: selectedYear } = selection;
  const scope = useMemo(
    () => profileId ? { profileId, month: selectedMonth, year: selectedYear } : null,
    [profileId, selectedMonth, selectedYear],
  );
  const activeScope = useRef<MonthScope | null>(null);
  const latestLoad = useRef<{ controller: AbortController; done: Promise<void> } | null>(null);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const visibleData = monthData?.scope === scope ? monthData : null;

  const rowOperations = useRef(new Map<string, RowOperation>());
  const [pendingRows, setPendingRows] = useState<ReadonlyMap<string, RowOperation>>(new Map());

  const setSelectedDate = useCallback((month: number, year: number) => {
    setSelection((previous) => ({ ...previous, month, year }));
  }, []);
  const setSelectedMonth = useCallback((month: number) => {
    setSelection((previous) => ({ ...previous, month }));
  }, []);
  const setSelectedYear = useCallback((year: number) => {
    setSelection((previous) => ({ ...previous, year }));
  }, []);

  const loadMonth = useCallback(async (target: MonthScope) => {
    latestLoad.current?.controller.abort();
    const controller = new AbortController();
    setMonthData((previous) => ({
      scope: target,
      rows: previous?.scope === target ? previous.rows : null,
      error: previous?.scope === target ? previous.error : null,
      loading: true,
    }));

    const isCurrent = () => activeScope.current === target && latestLoad.current?.controller === controller;
    const query = new URLSearchParams({
      profileId: target.profileId,
      month: String(target.month),
      year: String(target.year),
    });
    let done = (async () => {
      try {
        const rows = await requestApi<Transaction[]>('/transactions?' + query, loadErrorMessage, {
          signal: controller.signal,
        });
        if (!Array.isArray(rows)) throw new Error(loadErrorMessage);
        if (isCurrent()) setMonthData({ scope: target, rows, error: null, loading: false });
      } catch {
        if (isCurrent()) {
          setMonthData((previous) => ({
            scope: target,
            rows: previous?.scope === target ? previous.rows : null,
            error: loadErrorMessage,
            loading: false,
          }));
        }
      } finally {
        if (isCurrent()) latestLoad.current = null;
      }
    })();

    latestLoad.current = { controller, done };
    await done;
    // Se outra gravação iniciou uma consulta mais recente, aguarde essa atualização
    // antes de liberar as ações do lançamento.
    while (activeScope.current === target && latestLoad.current && latestLoad.current.done !== done) {
      done = latestLoad.current.done;
      await done;
    }
  }, []);

  useLayoutEffect(() => {
    activeScope.current = scope;
    if (scope) void loadMonth(scope);
    else setMonthData(null);
    return () => {
      activeScope.current = null;
      latestLoad.current?.controller.abort();
      latestLoad.current = null;
    };
  }, [scope, loadMonth]);

  const fetchTransactions = useCallback(async (month?: number, year?: number) => {
    const target = activeScope.current;
    if (target && (month ?? target.month) === target.month && (year ?? target.year) === target.year) {
      await loadMonth(target);
    }
  }, [loadMonth]);

  const refreshTransactions = useCallback(async (affectedProfileId: string) => {
    const target = activeScope.current;
    if (target?.profileId === affectedProfileId) await loadMonth(target);
  }, [loadMonth]);

  async function mutateRow(id: string, operation: RowOperation, send: () => Promise<unknown>, destinationProfileId?: string) {
    if (rowOperations.current.has(id)) throw new Error('Há uma alteração em andamento neste lançamento.');
    rowOperations.current.set(id, operation);
    setPendingRows(new Map(rowOperations.current));
    try {
      await send();
      const visibleProfileId = activeScope.current?.profileId;
      if (visibleProfileId && (visibleProfileId === profileId || visibleProfileId === destinationProfileId)) {
        await refreshTransactions(visibleProfileId);
      }
    } finally {
      rowOperations.current.delete(id);
      setPendingRows(new Map(rowOperations.current));
    }
  }

  async function addTransaction(data: CreateTransactionDTO) {
    const targetProfileId = data.profileId || profileId;
    if (!targetProfileId) throw new Error('Selecione um perfil para salvar este lançamento.');
    await requestApi('/transactions', 'Não foi possível salvar o lançamento. Tente novamente.', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, profileId: targetProfileId }),
    });
    await refreshTransactions(targetProfileId);
  }

  function updateTransaction(id: string, data: UpdateTransactionInput) {
    return mutateRow(id, 'save', () => requestApi(
      '/transactions/' + encodeURIComponent(id), 'Não foi possível salvar as alterações. Tente novamente.', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    ), data.profileId);
  }

  function toggleTransactionStatus(id: string, newStatus?: PaymentStatus) {
    return mutateRow(id, 'status', () => requestApi(
      '/transactions/' + encodeURIComponent(id) + '/status', 'Não foi possível alterar a situação do lançamento. Tente novamente.', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStatus ? { status: newStatus } : {}),
      },
    ));
  }

  function deleteTransaction(id: string, deleteAllGroup = false) {
    const query = deleteAllGroup ? '?deleteAll=true' : '';
    return mutateRow(id, 'delete', () => requestApi(
      '/transactions/' + encodeURIComponent(id) + query, 'Não foi possível excluir o lançamento. Tente novamente.',
      { method: 'DELETE' },
    ));
  }

  return (
    <TransactionContext.Provider
      value={{
        transactions: visibleData?.rows ?? [],
        hasMonthData: visibleData?.rows != null,
        loadError: visibleData?.error ?? null,
        isLoading: Boolean(scope && (visibleData?.loading ?? true)),
        pendingRows,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        setSelectedDate,
        fetchTransactions,
        refreshTransactions,
        addTransaction,
        updateTransaction,
        toggleTransactionStatus,
        deleteTransaction,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions(): TransactionContextData {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions deve ser utilizado dentro de um TransactionProvider');
  }
  return context;
}
