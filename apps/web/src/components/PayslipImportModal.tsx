import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Calendar,
  Layers,
  CreditCard,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type {
  PayslipParseResult,
  TransactionType,
  TransactionCategory,
  BatchCreateTransactionDTO,
  ApiResponse,
} from '@organizador/shared';
import { useProfiles, hexToRgba } from '../contexts/ProfileContext';
import { useTransactions } from '../contexts/TransactionContext';
import { Button, Input, Select } from './ui';

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
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  currentInstallment?: number;
  totalInstallments?: number;
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
  backdropFilter: 'blur(6px)',
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
  height: '92vh',
  maxHeight: '92vh',
  backgroundColor: 'white',
  borderRadius: '2xl',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
  fontSize: 'lg',
  fontWeight: 'bold',
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
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: { base: '6', sm: '12' },
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
  overflow: 'hidden',
  backgroundColor: 'slate.50',
});

const leftColumnStyle = css({
  width: { base: '100%', lg: '40%' },
  height: { base: '340px', lg: '100%' },
  display: 'flex',
  flexDirection: 'column',
  borderRightWidth: { base: '0', lg: '1px' },
  borderBottomWidth: { base: '1px', lg: '0' },
  borderRightStyle: 'solid',
  borderBottomStyle: 'solid',
  borderColor: 'slate.200',
  backgroundColor: 'white',
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
  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
});

const rightColumnStyle = css({
  width: { base: '100%', lg: '60%' },
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 1,
  backgroundColor: 'white',
});

const rightScrollAreaStyle = css({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: { base: '4', sm: '6' },
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
});

// 3 Metric Cards
const cardsGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
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
  backgroundColor: 'white',
  color: 'slate.900',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)',
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
  backgroundColor: 'white',
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
});

const tableScrollWrapperStyle = css({
  maxHeight: '340px',
  overflowY: 'auto',
  overflowX: 'auto',
});

const tableStyle = css({
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
  backgroundColor: 'white',
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
  backgroundColor: 'white',
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

  // Estados principais de etapa e preview
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  // Estados de requisição e parsing
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<PayslipParseResult | null>(null);

  // Modos de importação: 'net' (Modo 1) ou 'detailed' (Modo 2)
  const [importMode, setImportMode] = useState<'net' | 'detailed'>('detailed');

  // Modo 1 (Apenas Salário Líquido)
  const [netDescription, setNetDescription] = useState('Salário Líquido');
  const [netAmount, setNetAmount] = useState<number>(0);
  const [netCategory, setNetCategory] = useState<TransactionCategory>('fixed');

  // Modo 2 (Tabela Editável)
  const [items, setItems] = useState<EditablePayslipItem[]>([]);

  // Parâmetros de Projeção e Gravação em Lote (Rodapé)
  const [receiptDate, setReceiptDate] = useState(() => {
    const padMonth = String(selectedMonth).padStart(2, '0');
    return `${selectedYear}-${padMonth}-05`;
  });
  const [repeatMonths, setRepeatMonths] = useState<number>(1); // 1 = Apenas este mês, 6, 12

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

  // Limpa tudo ao fechar o modal ou desmontar
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

  // Tecla Escape fecha o modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isParsing && !isSubmitting) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isParsing, isSubmitting, handleClose]);

  // Bloqueio do scroll da janela
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Envio imediato do arquivo PDF para POST /api/payslip/parse
  const processPdfFile = async (file: File) => {
    if (!file) return;

    // Validação estrita de formato PDF
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setParseError('Formato inválido. Por favor, envie exclusivamente documentos no formato PDF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setParseError('O arquivo selecionado excede o tamanho máximo suportado de 5MB.');
      return;
    }

    // Revoga URL antiga caso exista e gera nova em memória
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

      // Preenche dados do Modo 1
      const employerLabel = parsed.employerName ? ` (${parsed.employerName})` : '';
      setNetDescription(`Salário Líquido${employerLabel}`);
      setNetAmount(parsed.netAmount || 0);
      setNetCategory('fixed');

      // Preenche itens do Modo 2
      const mappedItems: EditablePayslipItem[] = (parsed.items || []).map((it) => ({
        tempId: it.tempId || Math.random().toString(36).substring(2, 9),
        rawCode: it.rawCode,
        description: it.description || 'Lançamento',
        amount: Number(it.amount) || 0,
        type: it.type || 'income',
        category: it.suggestedCategory || 'fixed',
        currentInstallment: it.currentInstallment || 1,
        totalInstallments: it.totalInstallments || 1,
        selected: it.selected !== false,
      }));

      setItems(mappedItems);

      // Atualiza data de competência se identificada
      if (parsed.referenceMonth) {
        setReceiptDate(`${parsed.referenceMonth}-05`);
      }

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

  // Cálculos dinâmicos para os 3 Cards do Topo
  const { dynamicGross, dynamicDeductions, dynamicNet } = useMemo(() => {
    if (importMode === 'net') {
      return {
        dynamicGross: parsedData?.grossAmount || netAmount,
        dynamicDeductions: parsedData?.totalDeductions || 0,
        dynamicNet: netAmount,
      };
    }

    const selectedItems = items.filter((it) => it.selected);
    const gross = selectedItems
      .filter((it) => it.type === 'income')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const deductions = selectedItems
      .filter((it) => it.type === 'expense')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const net = gross - deductions;

    return {
      dynamicGross: gross,
      dynamicDeductions: deductions,
      dynamicNet: net,
    };
  }, [importMode, items, parsedData, netAmount]);

  // Manipulação dos itens da tabela editável (Modo 2)
  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => i.selected),
    [items]
  );
  const someSelected = useMemo(
    () => items.some((i) => i.selected) && !allSelected,
    [items, allSelected]
  );

  const toggleSelectAll = () => {
    const targetState = !allSelected;
    setItems((prev) => prev.map((item) => ({ ...item, selected: targetState })));
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
          // Se alterar categoria para 'installment', inicializa parcelas se vazias
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
      description: 'Novo Lançamento',
      amount: 100.0,
      type: 'expense',
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
        if (netAmount <= 0) {
          throw new Error('O valor líquido deve ser maior que zero.');
        }

        transactionsPayload = [
          {
            type: 'income' as TransactionType,
            category: netCategory,
            description: netDescription.trim() || 'Salário Líquido',
            amount: Math.round(netAmount * 100) / 100,
            date: receiptDate,
            status: 'pending' as const,
          },
        ];
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
          date: receiptDate,
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
    <div
      className={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isParsing && !isSubmitting) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={modalBoxStyle}>
        {/* Cabeçalho do Modal */}
        <div className={modalHeaderStyle}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
            <div
              style={{
                background: activeProfile
                  ? `linear-gradient(135deg, ${activeProfile.primaryColor}, ${activeProfile.secondaryColor})`
                  : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              }}
              className={css({
                width: '9',
                height: '9',
                borderRadius: 'lg',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              })}
            >
              <FileText size={18} />
            </div>

            <div>
              <h2 className={modalTitleStyle}>
                <span>Importação Inteligente de Contracheque</span>
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
                    })}
                  >
                    {parsedData.employerName}
                  </span>
                )}
              </h2>
              <p className={css({ fontSize: 'xs', color: 'slate.500', mt: '0.5' })}>
                {step === 'upload'
                  ? 'Envie o contracheque em PDF para extração automática de rendimentos e descontos.'
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
              className={cx(dropzoneBoxStyle, isDragging && dropzoneActiveStyle)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isParsing && fileInputRef.current?.click()}
            >
              <div
                style={{
                  background: activeProfile
                    ? hexToRgba(activeProfile.primaryColor, 0.12)
                    : 'rgba(59, 130, 246, 0.12)',
                  color: activeProfile?.primaryColor || '#3b82f6',
                }}
                className={css({
                  width: '16',
                  height: '16',
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
                    ? 'Nossa inteligência está analisando rubricas, parcelas e totais.'
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
                <span>Compatível com folhas de pagamento e holerites convencionais (PDF até 5MB)</span>
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
                {/* 1. Três Cards Compactos no Topo */}
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
                      {formatCurrency(dynamicGross)}
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
                      <span>Descontos</span>
                    </div>
                    <div className={metricValueStyle}>
                      {formatCurrency(dynamicDeductions)}
                    </div>
                  </div>

                  {/* Líquido a Receber (Cor Primária do Perfil Ativo) */}
                  <div
                    style={{
                      backgroundColor: activeProfile
                        ? hexToRgba(activeProfile.primaryColor, 0.08)
                        : 'rgba(59, 130, 246, 0.08)',
                      borderColor: activeProfile
                        ? hexToRgba(activeProfile.primaryColor, 0.3)
                        : '#93c5fd',
                      color: activeProfile?.primaryColor || '#2563eb',
                    }}
                    className={metricCardStyle}
                  >
                    <div className={metricLabelStyle}>
                      <Wallet size={12} />
                      <span>Líquido a Receber</span>
                    </div>
                    <div className={metricValueStyle}>
                      {formatCurrency(dynamicNet)}
                    </div>
                  </div>
                </div>

                {/* 2. Seletor de Estratégia de Lançamento */}
                <div className={modeSelectorContainerStyle}>
                  <button
                    type="button"
                    className={cx(
                      modeButtonStyle,
                      importMode === 'net' ? modeButtonActiveStyle : modeButtonInactiveStyle
                    )}
                    onClick={() => setImportMode('net')}
                  >
                    <Wallet size={14} />
                    <span>Modo 1: Apenas Salário Líquido</span>
                  </button>

                  <button
                    type="button"
                    className={cx(
                      modeButtonStyle,
                      importMode === 'detailed' ? modeButtonActiveStyle : modeButtonInactiveStyle
                    )}
                    onClick={() => setImportMode('detailed')}
                  >
                    <Layers size={14} />
                    <span>Modo 2: Detalhado (Bruto + Descontos)</span>
                  </button>
                </div>

                {/* CONTEÚDO MODO 1: APENAS SALÁRIO LÍQUIDO */}
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
                      gap: '3.5',
                    })}
                  >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                      <Sparkles size={16} className={css({ color: 'brand.primary' })} />
                      <span className={css({ fontSize: 'xs', fontWeight: 'bold', color: 'slate.800' })}>
                        Lançamento Único Simplificado
                      </span>
                    </div>
                    <p className={css({ fontSize: 'xs', color: 'slate.600' })}>
                      Será registrada uma única receita com a quantia final creditada em conta,
                      sem desmembrar INSS, impostos ou deduções individuais no fluxo.
                    </p>

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
                        value={netDescription}
                        onChange={(e) => setNetDescription(e.target.value)}
                        placeholder="Ex: Salário Empresa X"
                        required
                      />

                      <Input
                        label="Valor Líquido (R$)"
                        type="number"
                        step="0.01"
                        min="0.01"
                        size="sm"
                        value={netAmount || ''}
                        onChange={(e) => setNetAmount(parseFloat(e.target.value) || 0)}
                        required
                      />

                      <Select
                        label="Categoria"
                        size="sm"
                        value={netCategory}
                        onChange={(e) => setNetCategory(e.target.value as TransactionCategory)}
                      >
                        <option value="fixed">Fixa (Salário Mensal)</option>
                        <option value="recurring">Recorrente</option>
                        <option value="daily">Cotidiana</option>
                      </Select>
                    </div>
                  </div>
                )}

                {/* CONTEÚDO MODO 2: TABELA EDITÁVEL DETALHADA */}
                {importMode === 'detailed' && (
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
                    <div className={tableContainerStyle}>
                      <div className={tableHeaderBarStyle}>
                        <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={toggleSelectAll}
                            className={css({ cursor: 'pointer', accentColor: 'brand.primary' })}
                          />
                          <span>Selecionar todos os itens do contracheque</span>
                        </div>

                        <span
                          className={css({
                            fontSize: '2xs',
                            fontWeight: 'bold',
                            paddingX: '2',
                            paddingY: '0.5',
                            borderRadius: 'full',
                            backgroundColor: 'slate.200',
                            color: 'slate.700',
                          })}
                        >
                          {items.filter((i) => i.selected).length} de {items.length} selecionados
                        </span>
                      </div>

                      <div className={tableScrollWrapperStyle}>
                        <table className={tableStyle}>
                          <thead>
                            <tr>
                              <th className={tableThStyle} style={{ width: '32px' }}></th>
                              <th className={tableThStyle}>Descrição</th>
                              <th className={tableThStyle} style={{ width: '100px' }}>Tipo</th>
                              <th className={tableThStyle} style={{ width: '130px' }}>Categoria</th>
                              <th className={tableThStyle} style={{ width: '140px' }}>Parcelas</th>
                              <th className={tableThStyle} style={{ width: '120px' }}>Valor (R$)</th>
                              <th className={tableThStyle} style={{ width: '36px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => {
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
                                  </td>

                                  {/* Parcelas (Se categoria === installment) */}
                                  <td className={tableTdStyle}>
                                    {isParcelada ? (
                                      <div
                                        className={css({
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '1',
                                        })}
                                      >
                                        <div className={installmentBadgeStyle}>
                                          <CreditCard size={10} />
                                          <span>Parc.</span>
                                        </div>
                                        <input
                                          type="number"
                                          min="1"
                                          value={item.currentInstallment || 1}
                                          disabled={!item.selected}
                                          onChange={(e) =>
                                            updateItemField(
                                              item.tempId,
                                              'currentInstallment',
                                              parseInt(e.target.value, 10) || 1
                                            )
                                          }
                                          className={css({
                                            width: '10',
                                            height: '7',
                                            textAlign: 'center',
                                            fontSize: '2xs',
                                            borderRadius: 'md',
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: 'slate.200',
                                          })}
                                        />
                                        <span className={css({ fontSize: 'xs', color: 'slate.400' })}>
                                          /
                                        </span>
                                        <input
                                          type="number"
                                          min="1"
                                          value={item.totalInstallments || 12}
                                          disabled={!item.selected}
                                          onChange={(e) =>
                                            updateItemField(
                                              item.tempId,
                                              'totalInstallments',
                                              parseInt(e.target.value, 10) || 1
                                            )
                                          }
                                          className={css({
                                            width: '10',
                                            height: '7',
                                            textAlign: 'center',
                                            fontSize: '2xs',
                                            borderRadius: 'md',
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: 'slate.200',
                                          })}
                                        />
                                      </div>
                                    ) : (
                                      <span className={css({ fontSize: 'xs', color: 'slate.400', pl: '1' })}>
                                        —
                                      </span>
                                    )}
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
                                      className={tableInputStyle}
                                      placeholder="0.00"
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
                      <span>+ Nova Fonte / Desconto Manual</span>
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

              {/* 4. Rodapé da Coluna Direita: Data, Projeção e Gravação em Lote */}
              <div className={footerStyle}>
                <div className={footerControlsStyle}>
                  {/* Seletor de Data de Recebimento */}
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                    <label className={css({ fontSize: '2xs', fontWeight: 'bold', color: 'slate.600', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '1' })}>
                      <Calendar size={12} className={css({ color: 'slate.500' })} />
                      <span>Data de Recebimento</span>
                    </label>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className={css({
                        height: '8',
                        paddingX: '2',
                        fontSize: 'xs',
                        borderRadius: 'md',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'slate.200',
                        backgroundColor: 'white',
                        color: 'slate.800',
                        outline: 'none',
                        _focus: { borderColor: 'brand.primary' },
                      })}
                    />
                  </div>

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
                        backgroundColor: 'white',
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
                    style={{
                      background: activeProfile
                        ? `linear-gradient(135deg, ${activeProfile.primaryColor}, ${activeProfile.secondaryColor})`
                        : undefined,
                    }}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5',
                      height: '9',
                      paddingX: '4',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
    </div>
  );
};

export default PayslipImportModal;
