import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import type { IpcMainInvokeEvent, Session } from 'electron';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicWrite, DesktopData } from './desktop-data';
import { startLocalApi } from './local-api';

const product = 'Caderno de Dívidas';
const appId = 'br.com.organizador.dividas';
const desktopRoot = join(__dirname, '..');
const repo = join(desktopRoot, '..', '..');
const resources = app.isPackaged ? process.resourcesPath : desktopRoot;
const apiRoot = app.isPackaged ? join(resources, 'runtime', 'node_modules', '@organizador', 'api', 'dist') : join(repo, 'apps', 'api', 'dist');
const apiPaths = {
  apiRoot,
  entry: app.isPackaged ? join(resources, 'runtime', 'backend.js') : join(__dirname, 'backend.js'),
  webRoot: app.isPackaged ? join(resources, 'runtime', 'web') : join(repo, 'apps', 'web', 'dist-desktop'),
};
const setupPath = join(desktopRoot, 'setup', 'index.html');
const setupUrl = pathToFileURL(setupPath).href;
// A pasta histórica mantém os perfis, PINs e backups acessíveis após a renomeação.
const dataFolder = 'Organizador de Dívidas';
const defaultData = join(app.getPath('appData'), app.isPackaged ? dataFolder : `${dataFolder} (Desenvolvimento)`);
const root = resolve(app.commandLine.getSwitchValue('user-data-dir') || defaultData);
const tutorialPath = join(root, 'tutorial.json');

let data: DesktopData;
let api: Awaited<ReturnType<typeof startLocalApi>> | undefined;
let mainWindow: BrowserWindow | undefined;
let importWindow: BrowserWindow | undefined;
let importCandidate: Awaited<ReturnType<DesktopData['stageImport']>> | undefined;
let importBusy = false;
let quitting = false;
let quitAllowed = false;
let starting: Promise<void> | undefined;

function preferences(webSession: Session) {
  return {
    session: webSession, contextIsolation: true, sandbox: true, webSecurity: true, nodeIntegration: false,
    devTools: !app.isPackaged,
  };
}

function restrictSession(webSession: Session) {
  webSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  webSession.setPermissionCheckHandler(() => false);
  webSession.setDevicePermissionHandler(() => false);
  webSession.on('will-download', event => event.preventDefault());
}

function restrictWindow(window: BrowserWindow) {
  const contents = window.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-frame-navigate', event => event.preventDefault());
  contents.on('will-redirect', event => event.preventDefault());
  contents.on('will-attach-webview', event => event.preventDefault());
}

function focusWindow() {
  const window = importWindow ?? mainWindow;
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

async function createMainWindow(local: NonNullable<typeof api>) {
  const webSession = session.fromPartition('organizador');
  webSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: new URL(details.url).origin !== local.origin });
  });
  const window = new BrowserWindow({
    title: product, width: 1320, height: 860, minWidth: 720, minHeight: 560, show: false,
    webPreferences: { ...preferences(webSession), preload: join(__dirname, 'notebook-preload.js') },
  });
  restrictWindow(window);
  mainWindow = window;
  const contents = window.webContents;
  webSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const target = new URL(details.url);
    const requestHeaders = details.requestHeaders;
    for (const key of Object.keys(requestHeaders)) {
      if (key.toLowerCase() === 'x-organizador-desktop') delete requestHeaders[key];
    }
    if (!contents.isDestroyed() && target.origin === local.origin && /^\/api(?:\/|$)/.test(target.pathname) &&
        details.webContentsId === contents.id && details.frame === contents.mainFrame &&
        details.initiatorOrigin === local.origin && new URL(contents.mainFrame.url).origin === local.origin &&
        details.resourceType === 'xhr') {
      requestHeaders['X-Organizador-Desktop'] = local.credential;
    }
    callback({ requestHeaders });
  });
  window.on('closed', () => { if (mainWindow === window) mainWindow = undefined; });
  try {
    await window.loadURL(local.origin + '/');
    window.show();
  } catch (error) {
    window.destroy();
    throw error;
  }
}

async function closeApi() {
  const previous = api;
  api = undefined;
  await previous?.stop();
}

async function openDatabase(directory: string, secret: string) {
  const local = await startLocalApi(apiPaths, data.database(directory), secret);
  api = local;
  try {
    await createMainWindow(local);
  } catch (error) {
    await closeApi();
    throw error;
  }
  void local.exited.then(() => {
    if (quitting || api !== local) return;
    api = undefined;
    mainWindow?.destroy();
    launch('A API local encerrou inesperadamente.');
  });
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function startup(initialError?: string) {
  let failure = initialError;
  while (!quitting) {
    if (failure) {
      const { response } = await dialog.showMessageBox({
        type: 'error', title: product, message: `Não foi possível abrir o ${product}.`,
        detail: `${failure}\n\nPasta de dados: ${root}\nConsulte a seção de recuperação do README para restaurar uma cópia.`,
        buttons: ['Tentar novamente', 'Sair'], defaultId: 0, cancelId: 1, noLink: true,
      });
      if (response !== 0) { app.quit(); return; }
    }
    try {
      data = new DesktopData(root, join(resources, ...(app.isPackaged ? [] : ['resources']), 'legacy-transactions.sql'), app.isPackaged ?
        join(resources, 'migrations') : join(repo, 'apps', 'api', 'prisma', 'migrations'), join(apiRoot, 'pinHash.js'));
      const dir = data.current();
      const secret = await data.open(dir);
      if (!quitting) await openDatabase(dir, secret);
      return;
    } catch (error) {
      failure = message(error);
    }
  }
}

function launch(error?: string) {
  if (!starting && !quitting) {
    starting = startup(error).finally(() => { starting = undefined; });
  }
}

function showImport() {
  if (!mainWindow || quitting) return;
  if (importWindow) { focusWindow(); return; }
  const setupSession = session.fromPartition('organizador-importacao');
  const window = new BrowserWindow({
    parent: mainWindow, width: 600, height: 560, modal: true, autoHideMenuBar: true,
    webPreferences: { ...preferences(setupSession), preload: join(__dirname, 'import-preload.js') },
  });
  restrictWindow(window);
  importWindow = window;
  window.on('close', event => { if (importBusy && !quitting) event.preventDefault(); });
  window.on('closed', () => {
    if (importWindow === window) importWindow = undefined;
    if (importCandidate && !importBusy) {
      data.discard(importCandidate.dir);
      importCandidate = undefined;
    }
  });
  void window.loadFile(setupPath).catch(() => window.destroy());
}

function isImportWindow(event: IpcMainInvokeEvent) {
  return Boolean(importWindow && event.sender === importWindow.webContents &&
    event.senderFrame === event.sender.mainFrame && event.senderFrame.url === setupUrl);
}

function installImportHandlers() {
  ipcMain.handle('import-database:choose', async event => {
    if (!isImportWindow(event) || !importWindow || importBusy || quitting) return;
    importBusy = true;
    try {
      const { canceled, filePaths: [source] } = await dialog.showOpenDialog(importWindow, {
        title: 'Escolher o banco SQLite da versão web', properties: ['openFile'],
        filters: [{ name: 'Banco SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
      });
      if (canceled || !source || quitting) return;
      const next = await data.stageImport(source);
      if (importCandidate) data.discard(importCandidate.dir);
      importCandidate = next;
      return { file: basename(source), profiles: next.profiles.map(profile => profile.name) };
    } catch (error) {
      return { error: message(error) };
    } finally {
      importBusy = false;
    }
  });

  ipcMain.handle('import-database:confirm', async (event, input: unknown) => {
    if (!isImportWindow(event) || !importCandidate || importBusy || quitting) return;
    importBusy = true;
    const candidate = importCandidate;
    try {
      const secret = await data.confirm(candidate, input);
      if (quitting) return;
      await closeApi();
      importWindow?.destroy();
      mainWindow?.destroy();
      try {
        await openDatabase(candidate.dir, secret);
        data.select(candidate.dir);
        importCandidate = undefined;
      } catch (error) {
        await closeApi();
        mainWindow?.destroy();
        importCandidate = undefined;
        launch(`A base importada não foi ativada. A base anterior continua selecionada.\n${message(error)}`);
      }
      return undefined;
    } catch (error) {
      return { error: message(error) };
    } finally {
      importBusy = false;
    }
  });
}

function isMainWindow(event: IpcMainInvokeEvent) {
  return Boolean(api && mainWindow && event.sender === mainWindow.webContents &&
    event.senderFrame === event.sender.mainFrame && event.senderFrame.url === api.origin + '/');
}

function installTutorialHandlers() {
  ipcMain.handle('tutorial:read', event => {
    if (!isMainWindow(event)) return;
    try {
      return JSON.parse(readFileSync(tutorialPath, 'utf8')) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  });
  ipcMain.handle('tutorial:save', (event, input: unknown) => {
    if (!isMainWindow(event)) return;
    if (!input || typeof input !== 'object') throw new Error('Preferência do tutorial inválida.');
    const { choice, chapter, step } = input as Record<string, unknown>;
    const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,48}$/.test(value);
    if (choice === 'skipped' || choice === 'completed') {
      atomicWrite(tutorialPath, JSON.stringify({ choice }));
    } else if (choice === 'started' && validId(chapter) && validId(step)) {
      atomicWrite(tutorialPath, JSON.stringify({ choice, chapter, step }));
    } else {
      throw new Error('Preferência do tutorial inválida.');
    }
  });
}

app.setAppUserModelId(appId);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('no-proxy-server');
mkdirSync(root, { recursive: true });
app.setPath('userData', root);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);
  app.on('window-all-closed', () => { if (!starting && !importBusy && api) app.quit(); });
  app.on('before-quit', event => {
    if (quitAllowed) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void (async () => {
      await starting?.catch(() => {});
      await closeApi();
    })().finally(() => { quitAllowed = true; app.quit(); });
  });
  void app.whenReady().then(() => {
    restrictSession(session.fromPartition('organizador'));
    const setupSession = session.fromPartition('organizador-importacao');
    restrictSession(setupSession);
    setupSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: ![setupUrl, new URL('import.css', setupUrl).href, new URL('import.js', setupUrl).href].includes(details.url) });
    });
    installImportHandlers();
    installTutorialHandlers();
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Dados', submenu: [
      { label: 'Importar banco da versão web…', click: showImport },
      { type: 'separator' }, { label: 'Sair', accelerator: 'Alt+F4', click: () => app.quit() },
    ] }]));
    launch();
  });
}
