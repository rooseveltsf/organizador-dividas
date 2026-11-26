import { createContext, useContext } from 'react';
import type { NotebookView } from '../components/NotebookViews';
import type { ShoppingItem, Transaction } from '@organizador/shared';
import type { PayslipExample } from './examplePayslip';

export const EXAMPLE_PROFILE = 'Caderno de exemplo';

export type GuideScene = {
  view?: NotebookView;
  access?: 'cover' | 'directory' | 'empty' | 'protected' | 'unlock';
  panel?: 'create' | 'pin' | 'delete-profile' | 'expense' | 'light' | 'installment'
    | 'delete-series' | 'shopping-edit' | 'shopping-incomplete'
    | 'pdf-file' | 'pdf-review' | 'pdf-document' | 'pdf-entries' | 'pdf-deductions' | 'pdf-confirm';
  light?: 'absent' | 'pending' | 'paid';
  filters?: boolean;
  retry?: boolean;
  recover?: () => void;
  projection?: boolean;
  today: string;
  installment: Transaction;
  shopping: Record<'cash' | 'installments' | 'incomplete', ShoppingItem>;
  payslip?: PayslipExample;
};

export const GuideSceneContext = createContext<GuideScene | null>(null);
export const useGuideScene = () => useContext(GuideSceneContext);

export const GuideHelpContext = createContext<((button: HTMLButtonElement) => void) | null>(null);
