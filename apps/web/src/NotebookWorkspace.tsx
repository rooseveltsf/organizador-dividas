import { useState, type Dispatch, type SetStateAction } from 'react';
import { ProfileProvider, useProfiles, TransactionProvider, useTransactions } from './contexts';
import { Dashboard, ProfileSelectScreen } from './pages';
import { FutureCommitments } from './pages/FutureCommitments';
import { PurchaseSimulationPage } from './pages/PurchaseSimulation';
import { ShoppingList } from './pages/ShoppingList';
import type { NotebookView } from './components/NotebookViews';
import { firstFutureMonth } from './calendar';
import type { ShoppingItem, Transaction } from '@organizador/shared';
import type { ProfileSource } from './contexts/ProfileContext';
import { useGuideScene } from './tutorial/GuideContext';

function MainApp() {
  const { activeProfile, selectionVersion } = useProfiles();
  const scene = useGuideScene();
  const [profileNotice, setProfileNotice] = useState('');
  const [view, setView] = useState<NotebookView>(scene?.view ?? 'statement');
  const [futureMonth, setFutureMonth] = useState(firstFutureMonth);

  if (!activeProfile) {
    return <ProfileSelectScreen entryNotice={profileNotice} clearEntryNotice={() => setProfileNotice('')}
      onProfileCreated={(name) => setProfileNotice('Perfil ' + name + ' criado.')} />;
  }

  return (
    <ProfileWorkspace key={selectionVersion} profileId={activeProfile.id}
      {...{ profileNotice, setProfileNotice, view, setView, futureMonth, setFutureMonth }} />
  );
}

function ProfileWorkspace({ profileId, profileNotice, setProfileNotice, view, setView, futureMonth, setFutureMonth }: {
  profileId: string;
  profileNotice: string;
  setProfileNotice: Dispatch<SetStateAction<string>>;
  view: NotebookView;
  setView: Dispatch<SetStateAction<NotebookView>>;
  futureMonth: string;
  setFutureMonth: Dispatch<SetStateAction<string>>;
}) {
  const { setSelectedDate } = useTransactions();
  const [transactionTarget, setTransactionTarget] = useState<string | null>(null);
  const [simulationItem, setSimulationItem] = useState<ShoppingItem | null>(null);

  function openTransaction(tx: Pick<Transaction, 'id' | 'date'>) {
    setSelectedDate(Number(tx.date.slice(5, 7)), Number(tx.date.slice(0, 4)));
    setTransactionTarget(tx.id);
    setSimulationItem(null);
    setView('statement');
  }

  function changeView(next: NotebookView) {
    setProfileNotice('');
    setTransactionTarget(null);
    setSimulationItem(null);
    setView(next);
  }

  if (view === 'future') {
    return <FutureCommitments month={futureMonth} onMonthChange={setFutureMonth}
      onViewChange={changeView} onOpenTransaction={openTransaction} />;
  }
  if (view === 'purchase') return <PurchaseSimulationPage item={simulationItem} onViewChange={changeView} onOpenTransaction={openTransaction} />;
  if (view === 'shopping') return <ShoppingList profileId={profileId} onViewChange={changeView} onOpenTransaction={openTransaction}
    onSimulate={item => {
      changeView('purchase');
      setSimulationItem(item);
    }} />;

  return (
    <Dashboard entryNotice={profileNotice} onProfileSwitch={() => {
      setProfileNotice('');
      setTransactionTarget(null);
    }}
      onViewChange={changeView}
      transactionTarget={transactionTarget} onTransactionLocated={() => setTransactionTarget(null)}
      onProfileDeleted={(name) => setProfileNotice('Perfil ' + name + ' excluído.')} />
  );
}

export function NotebookWorkspace({ source }: { source?: ProfileSource }) {
  return (
    <ProfileProvider source={source}>
      <TransactionProvider>
        <MainApp />
      </TransactionProvider>
    </ProfileProvider>
  );
}

