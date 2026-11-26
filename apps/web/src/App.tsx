import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from './components/ui';
import { NotebookWorkspace } from './NotebookWorkspace';
import { NotebookCoverArt } from './pages/ProfileSelectScreen';
import { GuideHelpContext } from './tutorial/GuideContext';
import { guideChapters, guideRoute, lessonPosition } from './tutorial/chapters';
import { GuidedLesson } from './tutorial/GuidedLesson';
import { readGuidePreference, saveGuidePreference, type GuidePreference } from './tutorial/preferences';
import './tutorial/guide.css';

type Surface = 'notebook' | 'help' | 'lesson' | 'finish';
type ReturnPoint = { control: HTMLButtonElement; x: number; y: number };

export function App() {
  const [preference, setPreference] = useState<GuidePreference | null>();
  const [saveError, setSaveError] = useState(false);
  const [surface, setSurface] = useState<Surface>('notebook');
  const [chapters, setChapters] = useState(false);
  const [position, setPosition] = useState(0);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [revision, setRevision] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const returnPoint = useRef<ReturnPoint>();
  const writeVersion = useRef(0);
  const loading = preference === undefined;
  const welcome = preference === null && surface === 'notebook';
  const notebookVisible = !loading && !welcome && surface === 'notebook';
  const resume = preference?.choice === 'started' ? lessonPosition(preference.chapter, preference.step) : -1;

  useEffect(() => {
    let mounted = true;
    void readGuidePreference().then(value => {
      if (mounted) setPreference(value);
    }, () => {
      if (mounted) setPreference(null);
    });
    return () => { mounted = false; };
  }, []);

  useLayoutEffect(() => {
    if (notebookVisible) {
      setHasWorkspace(true);
      const point = returnPoint.current;
      returnPoint.current = undefined;
      if (point) {
        const control = point.control.isConnected ? point.control : document.querySelector<HTMLButtonElement>('.guide-help');
        control?.focus({ preventScroll: true });
        window.scrollTo(point.x, point.y);
      }
    } else if (!loading) {
      window.scrollTo(0, 0);
      title.current?.focus({ preventScroll: true });
    }
  }, [notebookVisible, loading, chapters, surface]);

  function save(value: GuidePreference) {
    setPreference(value);
    setSaveError(false);
    const version = ++writeVersion.current;
    void saveGuidePreference(value).catch(() => {
      if (writeVersion.current === version) setSaveError(true);
    });
  }

  function goTo(next: number, restart = false) {
    const entry = guideRoute[next];
    if (!entry) return;
    if (restart) setRevision(count => count + 1);
    setPosition(next);
    setChapters(false);
    setSurface('lesson');
    save({ choice: 'started', chapter: entry.chapter.id, step: entry.lesson.id });
  }

  function leave() {
    setChapters(false);
    setSurface('notebook');
  }

  function openHelp(control: HTMLButtonElement) {
    returnPoint.current = { control, x: window.scrollX, y: window.scrollY };
    setRevision(count => count + 1);
    setSurface('help');
  }

  return <>
    {(hasWorkspace || notebookVisible) && <div hidden={!notebookVisible}>
      <GuideHelpContext.Provider value={openHelp}><NotebookWorkspace /></GuideHelpContext.Provider>
    </div>}
    {loading && <p className="guide-loading" role="status">Abrindo o Caderno de Dívidas…</p>}
    {saveError && <p className="guide-save-error" role="status">Não foi possível guardar o progresso para a próxima abertura.</p>}
    {welcome && <main className="notebook-page guide-page">
      <GuideMasthead />
      <section className="notebook-sheet guide-front">
        <div className="cover-copy">
          <h1 ref={title} tabIndex={-1}>Boas-vindas ao Caderno de Dívidas</h1>
          <p>Aqui você pode anotar o que entra, acompanhar o que falta pagar e ver em que mês termina cada parcela. Quer conhecer seu caderno por dentro?</p>
          <div className="guide-actions">
            <Button onClick={() => goTo(0, true)}>Começar tutorial</Button>
            <Button variant="outline" onClick={() => { save({ choice: 'skipped' }); leave(); }}>Pular e usar o aplicativo</Button>
          </div>
        </div>
        <NotebookCoverArt />
      </section>
    </main>}
    {chapters && <main className="notebook-page guide-page">
      <GuideMasthead />
      <section className="notebook-sheet guide-chapters">
        <h1 ref={title} tabIndex={-1}>Capítulos do tutorial</h1>
        <div className="guide-actions">
          <Button variant="outline" onClick={() => setChapters(false)}>Voltar</Button>
          <Button variant="ghost" onClick={leave}>Sair do tutorial</Button>
        </div>
        <nav aria-label="Capítulos e passos do tutorial">
          {guideChapters.map(chapter => <details key={chapter.id} className="guide-chapter">
            <summary>{chapter.title}</summary>
            <ul>
              {chapter.steps.map(lesson => <li key={lesson.id}>
                <button type="button" onClick={() => goTo(lessonPosition(chapter.id, lesson.id))}>{lesson.title}</button>
              </li>)}
            </ul>
          </details>)}
        </nav>
      </section>
    </main>}
    {!chapters && surface === 'help' && <main className="notebook-page guide-page">
      <GuideMasthead />
      <section className="notebook-sheet guide-end">
        <h1 ref={title} tabIndex={-1}>Ajuda e tutorial</h1>
        <p>Experimente os controles no Caderno de exemplo ou abra o passo que quer consultar.</p>
        <div className="guide-actions">
          {resume >= 0 && <Button onClick={() => goTo(resume)}>Continuar de onde parei</Button>}
          <Button variant={resume >= 0 ? 'outline' : 'primary'} onClick={() => goTo(0, true)}>Recomeçar tutorial</Button>
          <Button variant="outline" onClick={() => setChapters(true)}>Ver capítulos</Button>
          <Button variant="ghost" onClick={leave}>Voltar ao aplicativo</Button>
        </div>
      </section>
    </main>}
    {!chapters && surface === 'lesson' && <GuidedLesson key={revision} position={position}
      onBack={() => goTo(position - 1)} onNext={() => {
        if (position + 1 < guideRoute.length) goTo(position + 1);
        else { save({ choice: 'completed' }); setSurface('finish'); }
      }}
      onChapters={() => setChapters(true)} onExit={leave} />}
    {!chapters && surface === 'finish' && <main className="notebook-page guide-page">
      <GuideMasthead />
      <section className="notebook-sheet guide-end">
        <h1 ref={title} tabIndex={-1}>Tudo pronto para usar seu caderno</h1>
        <div className="guide-actions">
          <Button onClick={leave}>Usar o Caderno de Dívidas</Button>
          <Button variant="outline" onClick={() => setChapters(true)}>Rever um capítulo</Button>
        </div>
      </section>
    </main>}
  </>;
}

function GuideMasthead() {
  return <header className="masthead">
    <div className="wordmark"><BookOpen size={24} strokeWidth={1.6} aria-hidden="true" /> Caderno de Dívidas</div>
  </header>;
}

export default App;
