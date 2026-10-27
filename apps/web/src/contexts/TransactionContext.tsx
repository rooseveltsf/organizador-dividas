import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Transaction, CreateTransactionDTO, ApiResponse } from '@organizador/shared';

const API_BASE_URL = 'http://localhost:3000';

export interface TransactionContextData {
  transactions: Transaction[];
  isLoading: boolean;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setSelectedDate: (month: number, year: number) => void;
  fetchTransactions: (month?: number, year?: number) => Promise<void>;
  addTransaction: (data: CreateTransactionDTO) => Promise<void>;
  deleteTransaction: (id: string, deleteAllGroup?: boolean) => Promise<void>;
}

export const TransactionContext = createContext<TransactionContextData | undefined>(undefined);

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({ children }) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setSelectedDate = useCallback((month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  }, []);

  const fetchTransactions = useCallback(
    async (month?: number, year?: number) => {
      const targetMonth = month ?? selectedMonth;
      const targetYear = year ?? selectedYear;

      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          month: String(targetMonth),
          year: String(targetYear),
        });

        const response = await fetch(`${API_BASE_URL}/transactions?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error(`Falha ao buscar transações: status ${response.status}`);
        }

        const result: ApiResponse<Transaction[]> = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setTransactions(result.data);
        } else {
          setTransactions([]);
        }
      } catch (error) {
        console.error('Erro ao buscar transações na API:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedMonth, selectedYear]
  );

  const addTransaction = useCallback(
    async (data: CreateTransactionDTO) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: ApiResponse = await response.json().catch(() => ({ success: false }));
          throw new Error(errorData.message || `Erro ao criar transação: ${response.statusText}`);
        }

        // Após o sucesso, recarrega automaticamente as transações
        await fetchTransactions(selectedMonth, selectedYear);
      } catch (error) {
        console.error('Erro ao adicionar transação:', error);
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

        // Após o sucesso, recarrega automaticamente as transações
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

  // Carrega as transações inicialmente e sempre que o mês ou ano selecionado mudar
  useEffect(() => {
    fetchTransactions(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchTransactions]);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        isLoading,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        setSelectedDate,
        fetchTransactions,
        addTransaction,
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
