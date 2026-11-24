import React, { useState, useRef, useMemo, useCallback } from 'react';
import { css, cx } from '@/styled-system/css';
import {
  FileText,
  UploadCloud,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  PlusCircle,
  Trash2,
  Layers,
  CreditCard,
  RefreshCw,
  Loader2,
  Sparkles,
  Clock,
  Coins,
} from 'lucide-react';
import type {
  PayslipParseResult,
  TransactionType,
  TransactionCategory,
  BatchCreateTransactionDTO,
  ApiResponse,
} from '@organizador/shared';
import { useProfiles } from '../contexts/ProfileContext';
import { useTransactions } from '../contexts/TransactionContext';
import { ModalLayer } from './ui/Modal';
import { Button, Input } from './ui';

const API_BASE_URL = 'http://localhost:3000';

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

function formatCurrency(value: number): string {
  return (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// ============================================================================
// Estilos Panda CSS
// ============================================================================

const overlayStyle = css({
  position: 'fixed',
  inset: '0',
  zIndex: 60,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: { base: '2', sm: '4', md: '6' },
  animation: 'fadeIn 0.2s ease-out forwards',
});

const modalBoxStyle = css({
  position: 'relative',
  width: '100%',
  maxWidth: '1280px',
  maxHeight: '94dvh',
  backgroundColor: 'bgCard',
  borderRadius: '2xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeIn 0.25s ease-out forwards',
});

const modalHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingX: { base: '4', sm: '6' },
  paddingY: '3.5',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'slate.200',
  backgroundColor: 'slate.50',
  flexShrink: 0,
});

const modalTitleStyle = css({
  fontFamily: 'heading',
  fontSize: '2xl',
  fontWeight: 'normal',
  flexWrap: 'wrap',
  color: 'slate.900',
  lineHeight: '1.2',
  display: 'flex',
  alignItems: 'center',
  gap: '2.5',
});

const closeButtonStyle = css({
  color: 'slate.400',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'lg',
  padding: '1.5',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease-in-out',
  _hover: {
    backgroundColor: 'slate.200',
    color: 'slate.700',
  },
});

// Drag & Drop
const dropzoneContainerStyle = css({
  overflowY: 'auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: { base: '4', sm: '8' },
  gap: '6',
  textAlign: 'center',
});

const dropzoneBoxStyle = css({
  width: '100%',
  maxWidth: '560px',
  padding: { base: '8', sm: '12' },
  borderRadius: '2xl',
  borderWidth: '2px',
  borderStyle: 'dashed',
  borderColor: 'slate.300',
  backgroundColor: 'slate.50',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  _hover: {
    borderColor: 'brand.primary',
    backgroundColor: 'brand.primarySoft',
  },
});

const dropzoneActiveStyle = css({
  borderColor: 'brand.primary',
  backgroundColor: 'brand.primarySoft',
  transform: 'scale(1.01)',
});

// Split screen
const splitScreenContainerStyle = css({
  display: 'flex',
  flexDirection: { base: 'column', lg: 'row' },
  flex: 1,
  minHeight: 0,
  overflowY: { base: 'auto', lg: 'hidden' },
  backgroundColor: 'slate.50',
});

const leftColumnStyle = css({
  width: { base: '100%', lg: '40%' },
  height: { base: '240px', lg: '100%' },
  display: 'flex',
  flexDirection: 'column',
  borderRightWidth: { base: '0', lg: '1px' },
  borderBottomWidth: { base: '1px', lg: '0' },
  borderRightStyle: 'solid',
  borderBottomStyle: 'solid',
  borderColor: 'slate.200',
  backgroundColor: 'bgCard',
  padding: { base: '3', sm: '4' },
  gap: '2.5',
  minHeight: 0,
  flexShrink: 0,
});

const leftHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  flexShrink: 0,
});

const iframeContainerStyle = css({
  flex: 1,
  minHeight: 0,
  width: '100%',
  height: '100%',
  borderRadius: 'xl',
  overflow: 'hidden',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  backgroundColor: 'slate.100',
});

const rightColumnStyle = css({
  width: { base: '100%', lg: '60%' },
  height: { base: 'auto', lg: '100%' },
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: { base: 'none', lg: 1 },
  backgroundColor: 'bgCard',
});

const rightScrollAreaStyle = css({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: { base: '4', sm: '6' },
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
});

// 3 Metric Cards
const cardsGridStyle = css({
  display: 'grid',
  gridTemplateColumns: { base: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: { base: '2', sm: '3' },
});

const metricCardStyle = css({
  padding: { base: '2.5', sm: '3.5' },
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  transition: 'transform 0.15s ease-in-out',
});

const metricLabelStyle = css({
  fontSize: '2xs',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  display: 'flex',
  alignItems: 'center',
  gap: '1',
});

const metricValueStyle = css({
  fontSize: { base: 'sm', sm: 'lg' },
  fontWeight: '800',
  lineHeight: '1.2',
});

// Adiantamento Banner
const advanceBannerStyle = css({
  padding: '3.5',
  borderRadius: 'xl',
  backgroundColor: 'brand.50',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'brand.200',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

// Mode Selector
const modeSelectorContainerStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  backgroundColor: 'slate.100',
  borderRadius: 'xl',
  padding: '1.5',
  gap: '1.5',
});

const modeButtonStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  paddingY: '2.5',
  paddingX: '3',
  borderRadius: 'lg',
  fontSize: 'xs',
  fontWeight: 'semibold',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  border: 'none',
  outline: 'none',
  textAlign: 'center',
});

const modeButtonActiveStyle = css({
  backgroundColor: 'bgCard',
  color: 'slate.900',
});

const modeButtonInactiveStyle = css({
  backgroundColor: 'transparent',
  color: 'slate.600',
  _hover: {
    color: 'slate.900',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

// Table Styles
const tableContainerStyle = css({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  borderRadius: 'xl',
  overflow: 'hidden',
  backgroundColor: 'bgCard',
});

const tableHeaderBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingX: '4',
  paddingY: '2.5',
  backgroundColor: 'slate.50',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'slate.200',
  fontSize: 'xs',
  color: 'slate.600',
  fontWeight: 'medium',
  flexWrap: 'wrap',
  gap: '2',
});

const tableScrollWrapperStyle = css({
  maxHeight: '340px',
  overflowY: 'auto',
  overflowX: 'auto',
});

const tableStyle = css({
  minWidth: '700px',
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: 'xs',
});

const tableThStyle = css({
  paddingX: '3',
  paddingY: '2.5',
  backgroundColor: 'slate.50',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'slate.200',
  color: 'slate.500',
  fontWeight: 'semibold',
  textTransform: 'uppercase',
  fontSize: '2xs',
  letterSpacing: 'wider',
  whiteSpace: 'nowrap',
});

const tableTdStyle = css({
  paddingX: '3',
  paddingY: '2.5',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'slate.100',
  verticalAlign: 'middle',
});

const tableRowStyle = css({
  transition: 'background-color 0.15s ease-in-out',
  _hover: {
    backgroundColor: 'slate.50',
  },
});

const tableRowIgnoredStyle = css({
  opacity: '0.45',
  backgroundColor: 'slate.50',
});

const tableInputStyle = css({
  height: '7',
  paddingX: '2',
  fontSize: 'xs',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  backgroundColor: 'bgCard',
  color: 'slate.800',
  outline: 'none',
  width: '100%',
  transition: 'all 0.15s ease-in-out',
  _focus: {
    borderColor: 'brand.primary',
    ring: '2px',
    ringColor: 'brand.primarySoft',
  },
});

const tableSelectStyle = css({
  height: '7',
  paddingX: '1.5',
  fontSize: 'xs',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  backgroundColor: 'bgCard',
  color: 'slate.800',
  outline: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  _focus: {
    borderColor: 'brand.primary',
  },
});

const installmentBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  paddingX: '1.5',
  paddingY: '0.5',
  borderRadius: 'md',
  backgroundColor: 'warning.50',
  color: 'warning.700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'warning.200',
  fontSize: '2xs',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
});

const advancePillStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  paddingX: '1.5',
  paddingY: '0.5',
  borderRadius: 'md',
  backgroundColor: 'brand.50',
  color: 'brand.700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'brand.200',
  fontSize: '2xs',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
});

// Footer
const footerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingX: { base: '4', sm: '6' },
  paddingY: '4',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'slate.200',
  backgroundColor: 'slate.50',
  flexShrink: 0,
  flexWrap: 'wrap',
  gap: '3',
});

const footerControlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  flexWrap: 'wrap',
});

const footerActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2.5',
});

export const PayslipImportModal: React.FC<PayslipImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeProfile } = useProfiles();
  const { fetchTransactions, selectedMonth, selectedYear } = useTransactions();

  // Estados principais
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  // Estados de requisição e parsing
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<PayslipParseResult | null>(null);

  // Modos de importação: 'net' (Modo 1) ou 'detailed' (Modo 2)
  const [importMode, setImportMode] = useState<'net' | 'detailed'>('net');

  // Modo 1: Configuração do Salário Líquido e Quinzena (Adiantamento)
  const [hasAdvance, setHasAdvance] = useState(false);

  // 1ª Entrada: Adiantamento Salarial (Quinzena / Dia 20)
  const [includeAdvance, setIncludeAdvance] = useState(true);
  const [advanceDescription, setAdvanceDescription] = useState('Adiantamento Salarial (Quinzena)');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceDate, setAdvanceDate] = useState<string>('');

  // 2ª Entrada: Saldo de Salário Líquido (5º dia útil)
  const [includeNetBalance, setIncludeNetBalance] = useState(true);
  const [netBalanceDescription, setNetBalanceDescription] = useState('Saldo de Salário (5º dia útil)');
  const [netBalanceAmount, setNetBalanceAmount] = useState<number>(0);
  const [netBalanceDate, setNetBalanceDate] = useState<string>('');

  // Modo 2: Tabela de Rubricas Detalhadas
  const [items, setItems] = useState<EditablePayslipItem[]>([]);
  const [tableFilter, setTableFilter] = useState<'incomes_only' | 'all'>('incomes_only');

  // Parâmetros de Projeção
  const [repeatMonths, setRepeatMonths] = useState<number>(1);

  // Estado de envio / gravação
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Limpeza de URL em memória
  const revokeCurrentPdfUrl = useCallback(() => {
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
      setPdfObjectUrl(null);
    }
  }, [pdfObjectUrl]);

  // Limpa tudo ao fechar o modal
  const handleClose = useCallback(() => {
    revokeCurrentPdfUrl();
    setStep('upload');
    setPdfFile(null);
    setIsParsing(false);
    setParseError(null);
    setParsedData(null);
    setItems([]);
    setSubmitError(null);
    onClose();
  }, [onClose, revokeCurrentPdfUrl]);

  // Envio imediato do arquivo PDF para POST /api/payslip/parse
  const processPdfFile = async (file: File) => {
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setParseError('Formato inválido. Por favor, envie exclusivamente documentos no formato PDF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setParseError('O arquivo selecionado excede o tamanho máximo suportado de 5MB.');
      return;
    }

    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
    }
    const localUrl = URL.createObjectURL(file);
    setPdfObjectUrl(localUrl);
    setPdfFile(file);
    setParseError(null);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/payslip/parse`, {
        method: 'POST',
        body: formData,
      });

      const result: ApiResponse<PayslipParseResult> = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Falha ao processar o contracheque em PDF.');
      }

      const parsed = result.data;
      setParsedData(parsed);

      // Tratamento Inteligente de Adiantamento Salarial / Quinzena
      const hasAdv = Boolean(parsed.hasAdvancePayment && (parsed.advanceAmount || 0) > 0);
      setHasAdvance(hasAdv);

      if (hasAdv) {
        setAdvanceAmount(parsed.advanceAmount || 0);
        setAdvanceDate(parsed.advanceDate || `${parsed.referenceMonth || '2026-07'}-20`);
        setIncludeAdvance(true);

        setNetBalanceAmount(parsed.netAmount || 0);
        setNetBalanceDate(parsed.netBalanceDate || `${parsed.referenceMonth || '2026-07'}-05`);
        setIncludeNetBalance(true);
      } else {
        setNetBalanceAmount(parsed.netAmount || 0);
        setNetBalanceDate(parsed.netBalanceDate || `${parsed.referenceMonth || '2026-07'}-05`);
      }

      // Preenche itens do Modo 2
      const mappedItems: EditablePayslipItem[] = (parsed.items || []).map((it) => ({
        tempId: it.tempId || Math.random().toString(36).substring(2, 9),
        rawCode: it.rawCode,
        description: it.description || 'Lançamento',
        reference: it.reference,
        amount: Number(it.amount) || 0,
        type: it.type || 'income',
        category: it.suggestedCategory || 'fixed',
        currentInstallment: it.currentInstallment || 1,
        totalInstallments: it.totalInstallments || 1,
        isAdvance: it.isAdvance,
        suggestedDate: it.suggestedDate,
        selected: it.selected !== false,
      }));

      setItems(mappedItems);
      setStep('review');
    } catch (err) {
      console.error('Erro ao analisar contracheque:', err);
      setParseError(
        err instanceof Error
          ? err.message
          : 'Não foi possível ler o arquivo. Verifique se o PDF contém texto selecionável.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processPdfFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      processPdfFile(selectedFile);
    }
  };

  // Itens filtrados para a tabela do Modo 2
  const visibleItems = useMemo(() => {
    if (tableFilter === 'incomes_only') {
      return items.filter((i) => i.type === 'income');
    }
    return items;
  }, [items, tableFilter]);

  // Manipulação da tabela editável
  const allVisibleSelected = useMemo(
    () => visibleItems.length > 0 && visibleItems.every((i) => i.selected),
    [visibleItems]
  );
  const someVisibleSelected = useMemo(
    () => visibleItems.some((i) => i.selected) && !allVisibleSelected,
    [visibleItems, allVisibleSelected]
  );

  const toggleSelectAllVisible = () => {
    const targetState = !allVisibleSelected;
    setItems((prev) =>
      prev.map((item) => {
        if (visibleItems.some((v) => v.tempId === item.tempId)) {
          return { ...item, selected: targetState };
        }
        return item;
      })
    );
  };

  const toggleItemSelection = (tempId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemField = <K extends keyof EditablePayslipItem>(
    tempId: string,
    field: K,
    value: EditablePayslipItem[K]
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.tempId === tempId) {
          const updated = { ...item, [field]: value };
          if (field === 'category' && value === 'installment') {
            updated.currentInstallment = updated.currentInstallment || 1;
            updated.totalInstallments = updated.totalInstallments || 12;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddNewItem = () => {
    const newItem: EditablePayslipItem = {
      tempId: Math.random().toString(36).substring(2, 9),
      description: 'Nova Receita / Entrada',
      amount: 100.0,
      type: 'income',
      category: 'fixed',
      selected: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = (tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  // Submissão do Payload em Lote para POST /api/transactions/batch
  const handleSaveBatch = async () => {
    if (!activeProfile) {
      setSubmitError('Nenhum perfil ativo selecionado para registrar os lançamentos.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      let transactionsPayload = [];

      if (importMode === 'net') {
        if (hasAdvance) {
          if (!includeAdvance && !includeNetBalance) {
            throw new Error('Selecione pelo menos uma das entradas (Adiantamento ou Saldo) para lançar.');
          }

          if (includeAdvance) {
            if (advanceAmount <= 0) throw new Error('O valor do adiantamento deve ser maior que zero.');
            if (!advanceDate) throw new Error('Informe a data do adiantamento.');

            transactionsPayload.push({
              type: 'income' as TransactionType,
              category: 'fixed' as TransactionCategory,
              description: advanceDescription.trim() || 'Adiantamento Salarial (Quinzena)',
              amount: Math.round(advanceAmount * 100) / 100,
              date: advanceDate,
              status: 'pending' as const,
            });
          }

          if (includeNetBalance) {
            if (netBalanceAmount <= 0) throw new Error('O valor do saldo líquido deve ser maior que zero.');
            if (!netBalanceDate) throw new Error('Informe a data do saldo líquido.');

            transactionsPayload.push({
              type: 'income' as TransactionType,
              category: 'fixed' as TransactionCategory,
              description: netBalanceDescription.trim() || 'Saldo de Salário (5º dia útil)',
              amount: Math.round(netBalanceAmount * 100) / 100,
              date: netBalanceDate,
              status: 'pending' as const,
            });
          }
        } else {
          if (netBalanceAmount <= 0) throw new Error('O valor líquido deve ser maior que zero.');
          if (!netBalanceDate) throw new Error('Informe a data de recebimento.');

          transactionsPayload.push({
            type: 'income' as TransactionType,
            category: 'fixed' as TransactionCategory,
            description: netBalanceDescription.trim() || 'Salário Líquido',
            amount: Math.round(netBalanceAmount * 100) / 100,
            date: netBalanceDate,
            status: 'pending' as const,
          });
        }
      } else {
        const activeItems = items.filter((it) => it.selected);

        if (activeItems.length === 0) {
          throw new Error('Selecione ao menos um item da tabela para adicionar ao perfil.');
        }

        for (const item of activeItems) {
          if (!item.description.trim()) {
            throw new Error('Todos os itens selecionados devem ter uma descrição válida.');
          }
          if (item.amount <= 0) {
            throw new Error(`O item "${item.description}" possui valor menor ou igual a zero.`);
          }
        }

        transactionsPayload = activeItems.map((item) => ({
          type: item.type,
          category: item.category,
          description: item.description.trim(),
          amount: Math.round(item.amount * 100) / 100,
          date: item.suggestedDate || netBalanceDate || new Date().toISOString().split('T')[0],
          currentInstallment:
            item.category === 'installment' ? Number(item.currentInstallment) || 1 : undefined,
          totalInstallments:
            item.category === 'installment' ? Number(item.totalInstallments) || 1 : undefined,
          status: 'pending' as const,
        }));
      }

      const payload: BatchCreateTransactionDTO = {
        profileId: activeProfile.id,
        repeatMonths: Number(repeatMonths) || 1,
        transactions: transactionsPayload,
      };

      const response = await fetch(`${API_BASE_URL}/api/transactions/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData: ApiResponse = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !resData.success) {
        throw new Error(
          resData.message || (resData.errors && resData.errors.join(', ')) || 'Erro ao registrar lançamentos em lote.'
        );
      }

      // Recarrega transações do perfil ativo
      await fetchTransactions(selectedMonth, selectedYear);

      if (onSuccess) {
        onSuccess();
      }

      handleClose();
    } catch (err) {
      console.error('Erro ao salvar lote de transações:', err);
      setSubmitError(err instanceof Error ? err.message : 'Erro inesperado ao salvar no perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalLayer
      className={overlayStyle}
      onDismiss={() => { if (!isParsing && !isSubmitting) handleClose(); }}
      aria-label="Importar contracheque"
    >
      <div className={cx(modalBoxStyle, step === 'review' && css({ height: '94dvh' }))}>
        {/* Cabeçalho do Modal */}
        <div className={modalHeaderStyle}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
            <FileText size={22} className={css({ color: 'brand.600', flexShrink: 0 })} />

            <div>
              <h2 className={modalTitleStyle}>
                <span>Importar contracheque</span>
                {parsedData?.employerName && (
                  <span
                    className={css({
                      fontSize: 'xs',
                      fontWeight: 'semibold',
                      color: 'slate.600',
                      backgroundColor: 'slate.200',
                      paddingX: '2',
                      paddingY: '0.5',
                      borderRadius: 'md',
                      maxWidth: '320px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {parsedData.employerName}
                  </span>
                )}
              </h2>
              <p className={css({ fontSize: 'xs', color: 'slate.500', mt: '0.5' })}>
                {step === 'upload'
                  ? 'Envie o contracheque em PDF para extração automática de rendimentos e adiantamentos.'
                  : `Documento: ${pdfFile?.name || 'contracheque.pdf'} • Perfil: ${activeProfile?.name || 'Ativo'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            className={closeButtonStyle}
            onClick={handleClose}
            aria-label="Fechar"
            disabled={isParsing || isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* ETAPA 1: ZONA DE DRAG & DROP E UPLOAD */}
        {step === 'upload' && (
          <div className={dropzoneContainerStyle}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            <div
              role="button"
              tabIndex={isParsing ? -1 : 0}
              aria-disabled={isParsing}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (!isParsing) fileInputRef.current?.click();
                }
              }}
              className={cx(dropzoneBoxStyle, isDragging && dropzoneActiveStyle)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isParsing && fileInputRef.current?.click()}
            >
              <div
                className={css({
                  color: 'brand.600',
                  borderRadius: 'full',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease-in-out',
                })}
              >
                {isParsing ? (
                  <Loader2 size={32} className={css({ animation: 'spin 1s linear infinite' })} />
                ) : (
                  <UploadCloud size={32} />
                )}
              </div>

              <div>
                <h3 className={css({ fontSize: 'base', fontWeight: 'bold', color: 'slate.800' })}>
                  {isParsing
                    ? 'Lendo dados do documento PDF...'
                    : 'Arraste o arquivo PDF do contracheque aqui'}
                </h3>
                <p className={css({ fontSize: 'sm', color: 'slate.500', mt: '1' })}>
                  {isParsing
                    ? 'Nossa inteligência está identificando proventos, adiantamento quinzenal e saldo líquido.'
                    : 'ou clique nesta área para navegar e selecionar'}
                </p>
              </div>

              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  fontSize: 'xs',
                  color: 'slate.400',
                  fontWeight: 'medium',
                })}
              >
                <Sparkles size={14} className={css({ color: 'brand.primary' })} />
                <span>Reconhecimento inteligente de 1ª via e adiantamentos quinzenais (PDF até 5MB)</span>
              </div>
            </div>

            {parseError && (
              <div
                className={css({
                  maxWidth: '560px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5',
                  padding: '3',
                  borderRadius: 'xl',
                  backgroundColor: 'expense.50',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'expense.200',
                  color: 'expense.700',
                  fontSize: 'xs',
                })}
              >
                <AlertCircle size={18} className={css({ flexShrink: 0 })} />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: SPLIT SCREEN (PREVIEW LADO A LADO + PAINEL DE REVISÃO) */}
        {step === 'review' && (
          <div className={splitScreenContainerStyle}>
            {/* Coluna da Esquerda (40% desktop): Visualizador Nativo do PDF */}
            <div className={leftColumnStyle}>
              <div className={leftHeaderStyle}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}>
                  <FileText size={15} className={css({ color: 'slate.500' })} />
                  <span className={css({ fontSize: 'xs', fontWeight: 'bold', color: 'slate.700' })}>
                    Visualização do PDF
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className={css({
                    fontSize: '2xs',
                    height: '7',
                    paddingX: '2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                  })}
                >
                  <RefreshCw size={12} />
                  <span>Trocar PDF</span>
                </Button>
              </div>

              <div className={iframeContainerStyle}>
                {pdfObjectUrl ? (
                  <iframe
                    src={pdfObjectUrl}
                    title="Visualizador do Contracheque"
                    className={css({
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    })}
                  />
                ) : (
                  <div
                    className={css({
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'slate.400',
                      fontSize: 'xs',
                    })}
                  >
                    Documento não carregado
                  </div>
                )}
              </div>
            </div>

            {/* Coluna da Direita (60% desktop): Painel de Revisão e Configuração */}
            <div className={rightColumnStyle}>
              <div className={rightScrollAreaStyle}>
                {/* 1. Três Cards de Totais Oficiais */}
                <div className={cardsGridStyle}>
                  {/* Salário Bruto (Verde) */}
                  <div
                    className={cx(
                      metricCardStyle,
                      css({
                        backgroundColor: 'income.50',
                        borderColor: 'income.200',
                        color: 'income.700',
                      })
                    )}
                  >
                    <div className={metricLabelStyle}>
                      <TrendingUp size={12} />
                      <span>Salário Bruto</span>
                    </div>
                    <div className={metricValueStyle}>
                      {formatCurrency(parsedData?.grossAmount || 0)}
                    </div>
                  </div>

                  {/* Total de Descontos (Vermelho) */}
                  <div
                    className={cx(
                      metricCardStyle,
                      css({
                        backgroundColor: 'expense.50',
                        borderColor: 'expense.200',
                        color: 'expense.700',
                      })
                    )}
                  >
                    <div className={metricLabelStyle}>
                      <TrendingDown size={12} />
                      <span>Descontos Folha</span>
                    </div>
                    <div className={metricValueStyle}>
                      {formatCurrency(parsedData?.totalDeductions || 0)}
                    </div>
                  </div>

                  {/* Líquido no Holerite (Cor Primária do Perfil) */}
                  <div
                    className={cx(metricCardStyle, css({ backgroundColor: 'brand.50', borderColor: 'brand.200', color: 'brand.700' }))}
                  >
                    <div className={metricLabelStyle}>
                      <Wallet size={12} />
                      <span>Líquido no Holerite</span>
                    </div>
                    <div className={metricValueStyle}>
                      {formatCurrency(parsedData?.netAmount || 0)}
                    </div>
                  </div>
                </div>

                {/* 2. Banner de Destaque Inteligente de Adiantamento Quinzenal */}
                {hasAdvance && (
                  <div className={advanceBannerStyle}>
                    <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                        <Sparkles size={16} className={css({ color: 'brand.primary' })} />
                        <span className={css({ fontSize: 'xs', fontWeight: 'bold', color: 'slate.900' })}>
                          Adiantamento Quinzenal Identificado
                        </span>
                      </div>
                      <span className={advancePillStyle}>
                        Recebido no Dia 20
                      </span>
                    </div>

                    <p className={css({ fontSize: 'xs', color: 'slate.600', margin: '0' })}>
                      O sistema identificou o <strong>DESC.ADIANTAMENTO SALARIAL</strong> de{' '}
                      <strong>{formatCurrency(advanceAmount)}</strong> como a quinzena recebida no dia 20.
                      Somado ao saldo líquido de <strong>{formatCurrency(netBalanceAmount)}</strong> no 5º dia útil,
                      seu total líquido em conta no mês é de{' '}
                      <strong className={css({ color: 'brand.primary' })}>
                        {formatCurrency(advanceAmount + netBalanceAmount)}
                      </strong>.
                    </p>
                  </div>
                )}

                {/* 3. Seletor de Estratégia de Lançamento */}
                <div className={modeSelectorContainerStyle}>
                  <button
                    type="button"
                    className={cx(
                      modeButtonStyle,
                      importMode === 'net' ? modeButtonActiveStyle : modeButtonInactiveStyle
                    )}
                    aria-pressed={importMode === 'net'}
                    onClick={() => setImportMode('net')}
                  >
                    <Coins size={14} />
                    <span>
                      {hasAdvance
                        ? 'Modo 1: Entradas Líquidas (Quinzena + Saldo)'
                        : 'Modo 1: Apenas Salário Líquido'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={cx(
                      modeButtonStyle,
                      importMode === 'detailed' ? modeButtonActiveStyle : modeButtonInactiveStyle
                    )}
                    aria-pressed={importMode === 'detailed'}
                    onClick={() => setImportMode('detailed')}
                  >
                    <Layers size={14} />
                    <span>Modo 2: Rubricas Detalhadas (Vencimentos)</span>
                  </button>
                </div>

                {/* CONTEÚDO MODO 1: ENTRADAS LÍQUIDAS REAIS EM CONTA */}
                {importMode === 'net' && (
                  <div
                    className={css({
                      padding: '4',
                      borderRadius: 'xl',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'slate.200',
                      backgroundColor: 'slate.50',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4',
                    })}
                  >
                    {hasAdvance ? (
                      <>
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                          <span className={css({ fontSize: 'xs', fontWeight: 'bold', color: 'slate.800' })}>
                            Lançamento das Entradas em Conta por Data
                          </span>
                          <p className={css({ fontSize: 'xs', color: 'slate.500', margin: '0' })}>
                            Registre as duas entradas de dinheiro que caem na sua conta bancária nos dias respectivos:
                          </p>
                        </div>

                        {/* Parcela 1: Adiantamento Quinzenal (Dia 20) */}
                        <div
                          className={css({
                            padding: '3',
                            borderRadius: 'lg',
                            backgroundColor: 'bgCard',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: 'slate.200',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2.5',
                          })}
                        >
                          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '2', cursor: 'pointer', fontSize: 'xs', fontWeight: 'bold', color: 'slate.800' })}>
                              <input
                                type="checkbox"
                                checked={includeAdvance}
                                onChange={(e) => setIncludeAdvance(e.target.checked)}
                                className={css({ accentColor: 'brand.primary' })}
                              />
                              <span>1. Quinzena (Adiantamento no Dia 20)</span>
                            </label>
                            <span className={advancePillStyle}>
                              <Clock size={10} /> Dia 20
                            </span>
                          </div>

                          <div
                            className={css({
                              display: 'grid',
                              gridTemplateColumns: { base: '1fr', sm: '2fr 1.2fr 1.2fr' },
                              gap: '2.5',
                              opacity: includeAdvance ? '1' : '0.4',
                            })}
                          >
                            <Input
                              label="Descrição"
                              size="sm"
                              value={advanceDescription}
                              disabled={!includeAdvance}
                              onChange={(e) => setAdvanceDescription(e.target.value)}
                            />

                            <Input
                              label="Valor (R$)"
                              type="number"
                              step="0.01"
                              min="0.01"
                              size="sm"
                              value={advanceAmount || ''}
                              disabled={!includeAdvance}
                              onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                            />

                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                              <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'slate.700' })}>
                                Data Recebimento
                              </label>
                              <input
                                type="date"
                                value={advanceDate}
                                disabled={!includeAdvance}
                                onChange={(e) => setAdvanceDate(e.target.value)}
                                className={tableInputStyle}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Parcela 2: Saldo de Salário Líquido (5º dia útil) */}
                        <div
                          className={css({
                            padding: '3',
                            borderRadius: 'lg',
                            backgroundColor: 'bgCard',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: 'slate.200',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2.5',
                          })}
                        >
                          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                            <label className={css({ display: 'flex', alignItems: 'center', gap: '2', cursor: 'pointer', fontSize: 'xs', fontWeight: 'bold', color: 'slate.800' })}>
                              <input
                                type="checkbox"
                                checked={includeNetBalance}
                                onChange={(e) => setIncludeNetBalance(e.target.checked)}
                                className={css({ accentColor: 'brand.primary' })}
                              />
                              <span>2. Saldo de Salário (5º Dia Útil)</span>
                            </label>
                            <span className={css({ fontSize: '2xs', fontWeight: 'bold', color: 'slate.600', backgroundColor: 'slate.100', paddingX: '1.5', paddingY: '0.5', borderRadius: 'md' })}>
                              5º Dia Útil
                            </span>
                          </div>

                          <div
                            className={css({
                              display: 'grid',
                              gridTemplateColumns: { base: '1fr', sm: '2fr 1.2fr 1.2fr' },
                              gap: '2.5',
                              opacity: includeNetBalance ? '1' : '0.4',
                            })}
                          >
                            <Input
                              label="Descrição"
                              size="sm"
                              value={netBalanceDescription}
                              disabled={!includeNetBalance}
                              onChange={(e) => setNetBalanceDescription(e.target.value)}
                            />

                            <Input
                              label="Valor (R$)"
                              type="number"
                              step="0.01"
                              min="0.01"
                              size="sm"
                              value={netBalanceAmount || ''}
                              disabled={!includeNetBalance}
                              onChange={(e) => setNetBalanceAmount(parseFloat(e.target.value) || 0)}
                            />

                            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                              <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'slate.700' })}>
                                Data Recebimento
                              </label>
                              <input
                                type="date"
                                value={netBalanceDate}
                                disabled={!includeNetBalance}
                                onChange={(e) => setNetBalanceDate(e.target.value)}
                                className={tableInputStyle}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Caso sem adiantamento salarial: Entrada única simples */
                      <div
                        className={css({
                          display: 'grid',
                          gridTemplateColumns: { base: '1fr', sm: '2fr 1fr 1fr' },
                          gap: '3',
                        })}
                      >
                        <Input
                          label="Descrição da Receita"
                          size="sm"
                          value={netBalanceDescription}
                          onChange={(e) => setNetBalanceDescription(e.target.value)}
                          placeholder="Ex: Salário Líquido"
                          required
                        />

                        <Input
                          label="Valor Líquido (R$)"
                          type="number"
                          step="0.01"
                          min="0.01"
                          size="sm"
                          value={netBalanceAmount || ''}
                          onChange={(e) => setNetBalanceAmount(parseFloat(e.target.value) || 0)}
                          required
                        />

                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
                          <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'slate.700' })}>
                            Data de Recebimento
                          </label>
                          <input
                            type="date"
                            value={netBalanceDate}
                            onChange={(e) => setNetBalanceDate(e.target.value)}
                            className={tableInputStyle}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CONTEÚDO MODO 2: TABELA DE RUBRICAS DETALHADAS */}
                {importMode === 'detailed' && (
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
                    <div className={tableContainerStyle}>
                      <div className={tableHeaderBarStyle}>
                        {/* Seletor de visualização (Apenas Receitas vs Todas) */}
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                          <button
                            type="button"
                            aria-pressed={tableFilter === 'incomes_only'}
                            onClick={() => setTableFilter('incomes_only')}
                            className={css({
                              paddingX: '2.5',
                              paddingY: '1',
                              borderRadius: 'md',
                              fontSize: '2xs',
                              fontWeight: 'bold',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: tableFilter === 'incomes_only' ? 'brand.primary' : 'slate.200',
                              color: tableFilter === 'incomes_only' ? 'white' : 'slate.700',
                              transition: 'all 0.15s ease',
                            })}
                          >
                            Apenas Receitas ({items.filter((i) => i.type === 'income').length})
                          </button>

                          <button
                            type="button"
                            aria-pressed={tableFilter === 'all'}
                            onClick={() => setTableFilter('all')}
                            className={css({
                              paddingX: '2.5',
                              paddingY: '1',
                              borderRadius: 'md',
                              fontSize: '2xs',
                              fontWeight: 'bold',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: tableFilter === 'all' ? 'brand.primary' : 'slate.200',
                              color: tableFilter === 'all' ? 'white' : 'slate.700',
                              transition: 'all 0.15s ease',
                            })}
                          >
                            Todas as Rubricas ({items.length})
                          </button>
                        </div>

                        {/* Checkbox selecionar todos do filtro atual */}
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                          <label className={css({ display: 'flex', alignItems: 'center', gap: '1.5', cursor: 'pointer', fontSize: '2xs', color: 'slate.600' })}>
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someVisibleSelected;
                              }}
                              onChange={toggleSelectAllVisible}
                              className={css({ cursor: 'pointer', accentColor: 'brand.primary' })}
                            />
                            <span>Selecionar todas ({visibleItems.filter((i) => i.selected).length}/{visibleItems.length})</span>
                          </label>
                        </div>
                      </div>

                      <div className={tableScrollWrapperStyle}>
                        <table className={tableStyle}>
                          <thead>
                            <tr>
                              <th className={tableThStyle} style={{ width: '32px' }}></th>
                              <th className={tableThStyle}>Descrição</th>
                              <th className={tableThStyle} style={{ width: '80px' }}>Ref.</th>
                              <th className={tableThStyle} style={{ width: '100px' }}>Tipo</th>
                              <th className={tableThStyle} style={{ width: '120px' }}>Categoria</th>
                              <th className={tableThStyle} style={{ width: '120px', textAlign: 'right' }}>Valor (R$)</th>
                              <th className={tableThStyle} style={{ width: '36px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleItems.map((item) => {
                              const isParcelada = item.category === 'installment';

                              return (
                                <tr
                                  key={item.tempId}
                                  className={cx(
                                    tableRowStyle,
                                    !item.selected && tableRowIgnoredStyle
                                  )}
                                >
                                  {/* Checkbox Individual */}
                                  <td className={tableTdStyle}>
                                    <input
                                      type="checkbox"
                                      checked={item.selected}
                                      onChange={() => toggleItemSelection(item.tempId)}
                                      className={css({ cursor: 'pointer', accentColor: 'brand.primary' })}
                                    />
                                  </td>

                                  {/* Descrição */}
                                  <td className={tableTdStyle}>
                                    <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}>
                                      <input
                                        type="text"
                                        value={item.description}
                                        disabled={!item.selected}
                                        onChange={(e) =>
                                          updateItemField(item.tempId, 'description', e.target.value)
                                        }
                                        className={tableInputStyle}
                                        placeholder="Nome da rubrica"
                                      />
                                      {item.isAdvance && (
                                        <span className={advancePillStyle} title="Adiantamento quinzenal no dia 20">
                                          Quinzena
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Referência (Horas / % / Dias) */}
                                  <td className={tableTdStyle}>
                                    <span className={css({ fontSize: '2xs', color: 'slate.500', fontWeight: 'medium' })}>
                                      {item.reference || '—'}
                                    </span>
                                  </td>

                                  {/* Tipo (Entrada ou Desconto) */}
                                  <td className={tableTdStyle}>
                                    <select
                                      value={item.type}
                                      disabled={!item.selected}
                                      onChange={(e) =>
                                        updateItemField(
                                          item.tempId,
                                          'type',
                                          e.target.value as TransactionType
                                        )
                                      }
                                      className={tableSelectStyle}
                                    >
                                      <option value="income">Entrada (+)</option>
                                      <option value="expense">Desconto (-)</option>
                                    </select>
                                  </td>

                                  {/* Categoria */}
                                  <td className={tableTdStyle}>
                                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                                      <select
                                        value={item.category}
                                        disabled={!item.selected}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.tempId,
                                            'category',
                                            e.target.value as TransactionCategory
                                          )
                                        }
                                        className={tableSelectStyle}
                                      >
                                        <option value="fixed">Fixa</option>
                                        <option value="recurring">Recorrente</option>
                                        <option value="installment">Parcelada</option>
                                        <option value="daily">Cotidiana</option>
                                      </select>
                                      {isParcelada && (
                                        <div className={installmentBadgeStyle}>
                                          <CreditCard size={10} />
                                          <span>
                                            Parc. {item.currentInstallment || 1}/{item.totalInstallments || 12}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Valor (R$) */}
                                  <td className={tableTdStyle}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={item.amount || ''}
                                      disabled={!item.selected}
                                      onChange={(e) =>
                                        updateItemField(
                                          item.tempId,
                                          'amount',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className={cx(tableInputStyle, css({ textAlign: 'right' }))}
                                      placeholder="0,00"
                                    />
                                  </td>

                                  {/* Excluir Linha */}
                                  <td className={tableTdStyle}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item.tempId)}
                                      className={css({
                                        color: 'slate.400',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '1',
                                        borderRadius: 'md',
                                        _hover: { color: 'expense.600', backgroundColor: 'expense.50' },
                                      })}
                                      title="Remover linha"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Botão + Nova Fonte / Desconto Manual */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewItem}
                      className={css({
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5',
                        fontSize: 'xs',
                        height: '8',
                        borderStyle: 'dashed',
                        borderColor: 'slate.300',
                        color: 'slate.700',
                        _hover: { borderColor: 'brand.primary', color: 'brand.primary' },
                      })}
                    >
                      <PlusCircle size={14} />
                      <span>+ Nova Fonte Manual</span>
                    </Button>
                  </div>
                )}

                {/* Alerta de Erro de Envio */}
                {submitError && (
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2.5',
                      padding: '3',
                      borderRadius: 'xl',
                      backgroundColor: 'expense.50',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'expense.200',
                      color: 'expense.700',
                      fontSize: 'xs',
                    })}
                  >
                    <AlertCircle size={18} className={css({ flexShrink: 0 })} />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>

              {/* 4. Rodapé da Coluna Direita: Projeção e Gravação em Lote */}
              <div className={footerStyle}>
                <div className={footerControlsStyle}>
                  {/* Projetar itens fixos para os próximos X meses */}
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                    <label className={css({ fontSize: '2xs', fontWeight: 'bold', color: 'slate.600', textTransform: 'uppercase' })}>
                      Projeção Futura (Fixos)
                    </label>
                    <select
                      value={repeatMonths}
                      onChange={(e) => setRepeatMonths(parseInt(e.target.value, 10))}
                      className={css({
                        height: '8',
                        paddingX: '2',
                        fontSize: 'xs',
                        borderRadius: 'md',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'slate.200',
                        backgroundColor: 'bgCard',
                        color: 'slate.800',
                        outline: 'none',
                        cursor: 'pointer',
                        _focus: { borderColor: 'brand.primary' },
                      })}
                    >
                      <option value={1}>Apenas este mês</option>
                      <option value={6}>Projetar por 6 meses</option>
                      <option value={12}>Projetar por 12 meses (1 ano)</option>
                    </select>
                  </div>
                </div>

                <div className={footerActionsStyle}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={handleSaveBatch}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5',
                      height: '9',
                      paddingX: '4',
                      fontWeight: 'bold',
                    })}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} />
                        <span>Adicionando...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Adicionar ao Perfil</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalLayer>
  );
};

export default PayslipImportModal;
