import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react';
import type {
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionInput,
  PaymentStatus,
  ApiResponse,
} from '@organizador/shared';
import { useProfiles } from './ProfileContext';

const API_BASE_URL = 'http://localhost:3000';

export interface TransactionContextData {
  transactions: Transaction[];
  hasMonthData: boolean;
  loadError: string | null;
  isLoading: boolean;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setSelectedDate: (month: number, year: number) => void;
  fetchTransactions: (month?: number, year?: number) => Promise<void>;
  addTransaction: (data: CreateTransactionDTO) => Promise<void>;
  updateTransaction: (id: string, data: UpdateTransactionInput) => Promise<void>;
  toggleTransactionStatus: (id: string, newStatus?: PaymentStatus) => Promise<void>;
  deleteTransaction: (id: string, deleteAllGroup?: boolean) => Promise<void>;
}

export const TransactionContext = createContext<TransactionContextData | undefined>(undefined);

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({ children }) => {
  const { activeProfile } = useProfiles();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const periodKey = [activeProfile?.id, selectedYear, selectedMonth].join('/');
  const currentPeriod = useRef(periodKey);
  const lastRequest = useRef(0);
  const [result, setResult] = useState<{ key: string; rows: Transaction[]; error: string | null }>();
  const hasMonthData = result?.key === periodKey && !result.error;
  const loadError = result?.key === periodKey ? result.error : null;
  const transactions = hasMonthData ? result.rows : [];

  const [isLoading, setIsLoading] = useState(false);

  useLayoutEffect(() => {
    currentPeriod.current = periodKey;
  }, [periodKey]);

  const setSelectedDate = useCallback((month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  }, []);

  const fetchTransactions = useCallback(
    async (month?: number, year?: number) => {
      if (!activeProfile) return;

      const targetMonth = month ?? selectedMonth;
      const targetYear = year ?? selectedYear;
      const key = [activeProfile.id, targetYear, targetMonth].join('/');
      if (currentPeriod.current !== key) return;
      const request = ++lastRequest.current;
      const isCurrent = () => currentPeriod.current === key && lastRequest.current === request;

      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          profileId: activeProfile.id,
          month: String(targetMonth),
          year: String(targetYear),
        });

        const response = await fetch(`${API_BASE_URL}/transactions?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error(`Falha ao buscar transações: status ${response.status}`);
        }

        const result: ApiResponse<Transaction[]> = await response.json();
        if (!result.success || !Array.isArray(result.data)) throw new Error('Resposta de lançamentos inválida.');
        if (isCurrent()) setResult({ key, rows: result.data, error: null });
      } catch (error) {
        console.error('Erro ao buscar transações na API:', error);
        if (isCurrent()) setResult({ key, rows: [], error: 'Não foi possível carregar os lançamentos deste mês.' });
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [activeProfile, selectedMonth, selectedYear]
  );

  const addTransaction = useCallback(
    async (data: CreateTransactionDTO) => {
      const targetProfileId = data.profileId || activeProfile?.id;
      if (!targetProfileId) {
        throw new Error('Nenhum perfil ativo selecionado para registrar a transação.');
      }

      const payload: CreateTransactionDTO = {
        ...data,
        profileId: targetProfileId,
      };

      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || `Erro ao criar transação: ${response.statusText}`);
        }

        // Após o sucesso, recarrega automaticamente as transações do perfil ativo
        await fetchTransactions(selectedMonth, selectedYear);
      } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [activeProfile, fetchTransactions, selectedMonth, selectedYear]
  );

  const updateTransaction = useCallback(
    async (id: string, data: UpdateTransactionInput) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || `Erro ao atualizar transação: ${response.statusText}`);
        }

        await fetchTransactions(selectedMonth, selectedYear);
      } catch (error) {
        console.error('Erro ao atualizar transação:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTransactions, selectedMonth, selectedYear]
  );

  const toggleTransactionStatus = useCallback(
    async (id: string, newStatus?: PaymentStatus) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/transactions/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newStatus ? { status: newStatus } : {}),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || `Erro ao atualizar status: ${response.statusText}`);
        }

        await fetchTransactions(selectedMonth, selectedYear);
      } catch (error) {
        console.error('Erro ao atualizar status da transação:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTransactions, selectedMonth, selectedYear]
  );

  const deleteTransaction = useCallback(
    async (id: string, deleteAllGroup: boolean = false) => {
      setIsLoading(true);
      try {
        const queryParams = deleteAllGroup ? '?deleteAll=true' : '';
        const response = await fetch(`${API_BASE_URL}/transactions/${id}${queryParams}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || `Erro ao deletar transação: ${response.statusText}`);
        }

        await fetchTransactions(selectedMonth, selectedYear);
      } catch (error) {
        console.error('Erro ao deletar transação:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTransactions, selectedMonth, selectedYear]
  );

  // Recarrega as transações sempre que o perfil ativo, mês ou ano mudar
  useEffect(() => {
    if (activeProfile) {
      fetchTransactions(selectedMonth, selectedYear);
    }
  }, [activeProfile?.id, selectedMonth, selectedYear, fetchTransactions]);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        hasMonthData,
        loadError,
        isLoading,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        setSelectedDate,
        fetchTransactions,
        addTransaction,
        updateTransaction,
        toggleTransactionStatus,
        deleteTransaction,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export function useTransactions(): TransactionContextData {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions deve ser utilizado dentro de um TransactionProvider');
  }
  return context;
}
