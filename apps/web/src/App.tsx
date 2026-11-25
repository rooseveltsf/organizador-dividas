import { useState, type Dispatch, type SetStateAction } from 'react';
import { ProfileProvider, useProfiles, TransactionProvider, useTransactions } from './contexts';
import { Dashboard, ProfileSelectScreen } from './pages';
import { FutureCommitments } from './pages/FutureCommitments';
import { PurchaseSimulationPage } from './pages/PurchaseSimulation';
import type { NotebookView } from './components/NotebookViews';
import { firstFutureMonth } from './calendar';
import type { Transaction } from '@organizador/shared';

function MainApp() {
  const { activeProfile, selectionVersion } = useProfiles();
  const [profileNotice, setProfileNotice] = useState('');
  const [view, setView] = useState<NotebookView>('statement');
  const [futureMonth, setFutureMonth] = useState(firstFutureMonth);

  if (!activeProfile) {
    return <ProfileSelectScreen entryNotice={profileNotice} clearEntryNotice={() => setProfileNotice('')}
      onProfileCreated={(name) => setProfileNotice('Perfil ' + name + ' criado.')} />;
  }

  return (
    <ProfileWorkspace key={selectionVersion}
      {...{ profileNotice, setProfileNotice, view, setView, futureMonth, setFutureMonth }} />
  );
}

function ProfileWorkspace({ profileNotice, setProfileNotice, view, setView, futureMonth, setFutureMonth }: {
  profileNotice: string;
  setProfileNotice: Dispatch<SetStateAction<string>>;
  view: NotebookView;
  setView: Dispatch<SetStateAction<NotebookView>>;
  futureMonth: string;
  setFutureMonth: Dispatch<SetStateAction<string>>;
}) {
  const { setSelectedDate } = useTransactions();
  const [transactionTarget, setTransactionTarget] = useState<string | null>(null);

  function openTransaction(tx: Pick<Transaction, 'id' | 'date'>) {
    setSelectedDate(Number(tx.date.slice(5, 7)), Number(tx.date.slice(0, 4)));
    setTransactionTarget(tx.id);
    setView('statement');
  }

  function changeView(next: NotebookView) {
    setProfileNotice('');
    setTransactionTarget(null);
    setView(next);
  }

  if (view === 'future') {
    return <FutureCommitments month={futureMonth} onMonthChange={setFutureMonth}
      onViewChange={changeView} onOpenTransaction={openTransaction} />;
  }
  if (view === 'purchase') return <PurchaseSimulationPage onViewChange={changeView} onOpenTransaction={openTransaction} />;

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

export function App() {
  return (
    <ProfileProvider>
      <TransactionProvider>
        <MainApp />
      </TransactionProvider>
    </ProfileProvider>
  );
}

export default App;
