import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';

export function NotebookHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="masthead">
      <div className="wordmark"><BookOpen aria-hidden="true" size={24} strokeWidth={1.6} />Organizador de Dívidas</div>
      <div className="masthead-tools">{children}</div>
    </header>
  );
}
