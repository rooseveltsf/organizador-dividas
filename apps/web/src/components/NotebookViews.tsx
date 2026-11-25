import { CalendarDays, List } from 'lucide-react';

export function NotebookViews({ current, onChange }: {
  current: 'statement' | 'future';
  onChange: () => void;
}) {
  return (
    <nav className="notebook-views" aria-label="Visões do perfil">
      <button type="button" aria-current={current === 'statement' ? 'page' : undefined}
        onClick={current === 'future' ? onChange : undefined}>
        <List size={16} aria-hidden="true" /> Extrato
      </button>
      <button type="button" aria-current={current === 'future' ? 'page' : undefined}
        onClick={current === 'statement' ? onChange : undefined}>
        <CalendarDays size={16} aria-hidden="true" /> Compromissos futuros
      </button>
    </nav>
  );
}
