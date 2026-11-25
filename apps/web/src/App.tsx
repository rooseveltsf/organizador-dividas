import { useState } from 'react';
import { ProfileProvider, useProfiles, TransactionProvider } from './contexts';
import { Dashboard, ProfileSelectScreen } from './pages';

function MainApp() {
  const { activeProfile } = useProfiles();
  const [profileNotice, setProfileNotice] = useState('');

  if (!activeProfile) {
    return <ProfileSelectScreen entryNotice={profileNotice} clearEntryNotice={() => setProfileNotice('')}
      onProfileCreated={(name) => setProfileNotice('Perfil ' + name + ' criado.')} />;
  }

  return (
    <TransactionProvider>
      <Dashboard entryNotice={profileNotice} onProfileSwitch={() => setProfileNotice('')}
        onProfileDeleted={(name) => setProfileNotice('Perfil ' + name + ' excluído.')} />
    </TransactionProvider>
  );
}

export function App() {
  return (
    <ProfileProvider>
      <MainApp />
    </ProfileProvider>
  );
}

export default App;
