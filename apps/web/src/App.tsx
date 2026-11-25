import { useState } from 'react';
import { ProfileProvider, useProfiles, TransactionProvider, useTransactions } from './contexts';
import { Dashboard, ProfileSelectScreen } from './pages';
import { FutureCommitments } from './pages/FutureCommitments';
import { firstFutureMonth } from './calendar';
import type { Transaction } from '@organizador/shared';

function MainApp() {
  const { activeProfile } = useProfiles();
  const { setSelectedDate } = useTransactions();
  const [profileNotice, setProfileNotice] = useState('');
  const [isFuture, setIsFuture] = useState(false);
  const [futureMonth, setFutureMonth] = useState(firstFutureMonth);
  const [transactionTarget, setTransactionTarget] = useState<string | null>(null);

  function openTransaction(tx: Transaction) {
    setSelectedDate(Number(tx.date.slice(5, 7)), Number(tx.date.slice(0, 4)));
    setTransactionTarget(tx.id);
    setIsFuture(false);
  }

  if (!activeProfile) {
    return <ProfileSelectScreen entryNotice={profileNotice} clearEntryNotice={() => setProfileNotice('')}
      onProfileCreated={(name) => setProfileNotice('Perfil ' + name + ' criado.')} />;
  }

  if (isFuture) {
    return <FutureCommitments month={futureMonth} onMonthChange={setFutureMonth}
      onStatement={() => setIsFuture(false)} onOpenTransaction={openTransaction} />;
  }

  return (
    <Dashboard key={activeProfile.id} entryNotice={profileNotice} onProfileSwitch={() => {
      setProfileNotice('');
      setTransactionTarget(null);
    }}
      onFutureCommitments={() => {
        setProfileNotice('');
        setTransactionTarget(null);
        setIsFuture(true);
      }}
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
