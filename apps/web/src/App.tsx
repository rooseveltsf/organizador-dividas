import { TransactionProvider } from './contexts';
import { Dashboard } from './pages';

export function App() {
  return (
    <TransactionProvider>
      <Dashboard />
    </TransactionProvider>
  );
}

export default App;
