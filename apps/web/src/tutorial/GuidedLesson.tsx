import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Transaction } from '@organizador/shared';
import { NotebookWorkspace } from '../NotebookWorkspace';
import { Button } from '../components/ui';
import { EXAMPLE_PROFILE, GuideSceneContext } from './GuideContext';
import { guideRoute } from './chapters';
import { exampleNotebook } from './exampleNotebook';

type LessonProps = {
  position: number;
  onBack: () => void;
  onNext: () => void;
  onChapters: () => void;
  onExit: () => void;
};

const focusable = 'button:not(:disabled), input:not([type=hidden]):not(:disabled), select:not(:disabled), summary, a[href]';
const visible = (element: HTMLElement) => element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';

export function GuidedLesson({ position, onBack, onNext, onChapters, onExit }: LessonProps) {
  const { chapter, lesson, index } = guideRoute[position];
  const history = useRef<{ saved?: Transaction }>({});
  const { scene, source } = useMemo(() => exampleNotebook(lesson.scene, history.current), [lesson]);
  const demo = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [hasTarget, setHasTarget] = useState(false);

  function targets() {
    return Array.from(demo.current?.querySelectorAll<HTMLElement>(lesson.target) ?? []).filter(visible);
  }

  function goToTarget() {
    const target = targets()[0];
    if (!target) return;
    const control = target.matches(focusable) ? target
      : Array.from(target.querySelectorAll<HTMLElement>(focusable)).find(visible);
    if (!control && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    (control ?? target).focus({ preventScroll: true });
    (control ?? target).scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  useLayoutEffect(() => {
    const container = demo.current!;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    let aligned = false;
    let frame = 0;
    function highlight() {
      const matches = targets();
      setHasTarget(matches.length > 0);
      const selected = new Set(matches);
      container.querySelectorAll<HTMLElement>('[data-guide-focus]').forEach(element => {
        if (!selected.has(element)) element.removeAttribute('data-guide-focus');
      });
      for (const element of matches) {
        element.setAttribute('data-guide-focus', '');
        const descriptions = new Set(element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean));
        descriptions.add('guide-instructions');
        element.setAttribute('aria-describedby', [...descriptions].join(' '));
      }
      const target = matches[0];
      if (!aligned && target && window.matchMedia('(min-width: 64rem) and (min-height: 36rem)').matches) {
        aligned = true;
        if (target.getBoundingClientRect().bottom > window.innerHeight - 70 && document.activeElement === heading.current) {
          target.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
      }
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(highlight);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'data-pane'] });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [lesson]);

  return <div className="guide-frame">
    <aside className="guide-sidebar" aria-label="Orientação do tutorial">
      <div className="guide-sidebar-copy">
        <p className="guide-example">Demonstração · {EXAMPLE_PROFILE}</p>
        <p className="guide-progress" id="guide-progress">{chapter.title} · passo {index + 1} de {chapter.steps.length}</p>
        <h1 tabIndex={-1} ref={heading} aria-describedby="guide-progress guide-instructions">{lesson.title}</h1>
        <p id="guide-instructions">{lesson.text}</p>
        <button className="guide-jump" type="button" onClick={goToTarget} disabled={!hasTarget}>Ir ao controle do exemplo</button>
      </div>
      <nav className="guide-navigation" aria-label="Navegação do tutorial">
        <span className="guide-mobile-indicator" aria-hidden="true">Demonstração · {EXAMPLE_PROFILE}</span>
        <Button variant="outline" onClick={onBack} disabled={position === 0}>Voltar</Button>
        <Button onClick={onNext}>Avançar</Button>
        <Button variant="ghost" onClick={onChapters}>Ver capítulos</Button>
        <Button variant="ghost" onClick={onExit}>Sair do tutorial</Button>
      </nav>
    </aside>
    <div className="guide-demo" ref={demo} aria-label="Caderno de exemplo">
      {chapter.id === 'windows' ? <WindowsExample key={lesson.id} initial={index} /> :
        <GuideSceneContext.Provider key={position} value={scene}><NotebookWorkspace source={source} /></GuideSceneContext.Provider>}
    </div>
  </div>;
}

function WindowsExample({ initial }: { initial: number }) {
  const [menu, setMenu] = useState(initial === 0);
  const [importing, setImporting] = useState(initial > 0);
  const [selected, setSelected] = useState(initial > 1);
  const [feedback, setFeedback] = useState('');
  return <main className="notebook-page">
    <section className="notebook-sheet guide-windows" aria-label="Exemplo do menu Dados">
      <Button variant="outline" data-guide="windows-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>Dados</Button>
      {menu && <div className="guide-windows-actions">
        <Button variant="ghost" onClick={() => { setImporting(true); setMenu(false); setFeedback(''); }}>Importar banco da versão web…</Button>
        <Button variant="ghost" onClick={() => { setMenu(false); setFeedback('No uso normal, o aplicativo seria fechado.'); }}>Sair</Button>
      </div>}
      {importing && <section aria-label="Importar banco da versão web">
        <h2>Importar banco da versão web</h2>
        <Button data-guide="windows-choose" onClick={() => { setSelected(true); setFeedback('Arquivo de exemplo selecionado: caderno-exemplo.sqlite.'); }}>
          Selecionar banco SQLite
        </Button>
        {selected && <div className="guide-actions">
          <p>caderno-exemplo.sqlite</p>
          <Button data-guide="windows-activate" onClick={() => { setSelected(false); setImporting(false); setFeedback('Cópia de demonstração ativada.'); }}>
            Ativar base importada
          </Button>
        </div>}
      </section>}
      <p role="status">{feedback}</p>
    </section>
  </main>;
}
