import { ProfileProvider, useProfiles, TransactionProvider } from './contexts';
import { Dashboard, ProfileSelectScreen } from './pages';
import { css } from '@/styled-system/css';

function MainApp() {
  const { activeProfile, isLoading } = useProfiles();

  if (isLoading) {
    return (
      <div
        className={css({
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'slate.50',
          gap: '3',
        })}
      >
        <div
          className={css({
            width: '10',
            height: '10',
            borderRadius: 'full',
            borderWidth: '3px',
            borderStyle: 'solid',
            borderColor: 'brand.primary',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          })}
        />
        <p className={css({ color: 'slate.500', fontSize: 'sm', fontWeight: 'medium' })}>
          Carregando perfis...
        </p>
      </div>
    );
  }

  if (!activeProfile) {
    return <ProfileSelectScreen />;
  }

  return (
    <TransactionProvider>
      <Dashboard />
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
