import { randomBytes } from 'node:crypto';
import { utilityProcess } from 'electron';

export async function startLocalApi(paths: { entry: string; apiRoot: string; webRoot: string }, database: string, pinSecret: string) {
  const credential = randomBytes(32).toString('base64url');
  // O pacote leva seu próprio Prisma Client. Nenhuma variável do checkout configura a API desktop.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(?:DATABASE_URL$|PROFILE_PIN_SECRET$|PRISMA_|NODE_|ELECTRON_|VITE_)/i.test(name)));
  const child = utilityProcess.fork(paths.entry, [], { env, stdio: 'ignore', serviceName: 'API local do Caderno de Dívidas' });
  const exited = new Promise<number>(resolve => child.once('exit', resolve));
  let alive = true;
  void exited.then(() => { alive = false; });
  async function stop() {
    if (!alive) return;
    child.postMessage('stop');
    const timeout = setTimeout(() => child.kill(), 8000);
    try {
      await exited;
    } finally {
      clearTimeout(timeout);
    }
  }

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A API local demorou para responder.')), 25_000);
    child.once('exit', () => reject(new Error('A API local encerrou durante a inicialização.')));
    child.once('spawn', () => child.postMessage({ ...paths, database, pinSecret, credential }));
    child.once('message', message => {
      clearTimeout(timer);
      if (message?.type === 'ready' && Number.isInteger(message.port) && message.port > 0 && message.port <= 65535) {
        resolve(message.port);
      } else {
        reject(new Error(message?.message ?? 'Falha na inicialização da API local.'));
      }
    });
    void exited.then(() => clearTimeout(timer));
  }).catch(async error => {
    await stop();
    throw error;
  });
  return { origin: `http://127.0.0.1:${port}`, credential, stop, exited };
}
