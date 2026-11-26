export type GuidePreference = { choice: 'skipped' | 'completed' } |
  { choice: 'started'; chapter: string; step: string };

declare global {
  interface Window {
    notebookTutorial?: { read: () => Promise<unknown>; save: (value: GuidePreference) => Promise<void> };
  }
}

const key = '@organizador:tutorial';

export async function readGuidePreference(): Promise<GuidePreference | null> {
  const value = __ORGANIZADOR_DESKTOP__
    ? await window.notebookTutorial?.read()
    : JSON.parse(localStorage.getItem(key) ?? 'null');
  if (value?.choice === 'skipped' || value?.choice === 'completed') return { choice: value.choice };
  if (value?.choice === 'started' && typeof value.chapter === 'string' && typeof value.step === 'string')
    return { choice: 'started', chapter: value.chapter, step: value.step };
  return null;
}

export async function saveGuidePreference(value: GuidePreference) {
  if (__ORGANIZADOR_DESKTOP__) {
    if (!window.notebookTutorial) throw new Error('As preferências locais estão indisponíveis.');
    await window.notebookTutorial.save(value);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
