import { Calculator, CalendarDays, List } from 'lucide-react';

export type NotebookView = 'statement' | 'future' | 'purchase';

const views = [
  { key: 'statement', label: 'Extrato', Icon: List },
  { key: 'future', label: 'Compromissos futuros', Icon: CalendarDays },
  { key: 'purchase', label: 'Simular compra', Icon: Calculator },
] as const;

export function NotebookViews({ current, onChange }: { current: NotebookView; onChange: (view: NotebookView) => void }) {
  return (
    <nav className="notebook-views" aria-label="Visões do perfil">
      {views.map(({ key, label, Icon }) => (
        <button key={key} type="button" aria-current={current === key ? 'page' : undefined}
          onClick={current !== key ? () => onChange(key) : undefined}>
          <Icon size={16} aria-hidden="true" /> {label}
        </button>
      ))}
    </nav>
  );
}
