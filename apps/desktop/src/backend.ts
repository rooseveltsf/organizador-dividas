import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire, registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface Configuration {
  database: string;
  pinSecret: string;
  credential: string;
  apiRoot: string;
  webRoot: string;
}

const port = process.parentPort;
let stop: (() => Promise<void>) | undefined;

function configurePdfRuntime(apiRoot: string) {
  const resolveApi = createRequire(join(apiRoot, 'app.js'));
  const pdfRoot = dirname(resolveApi.resolve('pdfjs-dist/package.json'));
  const modules = new Set(['pdf.mjs', 'pdf.worker.mjs'].map(file => pathToFileURL(join(pdfRoot, 'legacy', 'build', file)).href));
  // PDF.js 6 confunde o utilityProcess, que tem Node e nenhum DOM, com um renderer.
  // Aplique a distinção somente aos dois módulos ESM do parser neste processo.
  registerHooks({ load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!modules.has(url) || !loaded.source) return loaded;
    const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source);
    return { ...loaded, source: source.replace(
      'process.type !== "browser")', 'process.type !== "browser" && process.type !== "utility")',
    ) };
  } });
}

async function start(configuration: Configuration) {
  process.env.DATABASE_URL = 'file:' + configuration.database.replaceAll('\\', '/');
  process.env.PROFILE_PIN_SECRET = configuration.pinSecret;
  process.env.NODE_ENV = 'production';
  configurePdfRuntime(configuration.apiRoot);
  const { prisma } = require(join(configuration.apiRoot, 'prisma.js')) as {
    prisma: { $connect(): Promise<void>; $disconnect(): Promise<void> };
  };
  try {
    const { createApp } = require(join(configuration.apiRoot, 'app.js')) as {
      createApp(options: { credential: string; webRoot: string }): (req: IncomingMessage, res: ServerResponse) => void;
    };
    await prisma.$connect();
    const server = createServer(createApp(configuration));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    stop = async () => {
      const closed = once(server, 'close');
      server.close();
      await closed;
      await prisma.$disconnect();
    };
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Endereço de loopback indisponível.');
    port.postMessage({ type: 'ready', port: address.port });
  } catch {
    await prisma.$disconnect().catch(() => {});
    throw new Error('Não foi possível iniciar a API ou conectar ao banco local.');
  }
}

port.once('message', async ({ data }: { data: Configuration }) => {
  try {
    await start(data);
    port.on('message', async ({ data: command }) => {
      if (command !== 'stop' || !stop) return;
      const shutdown = stop;
      stop = undefined;
      try {
        await shutdown();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  } catch (error) {
    port.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Falha na API local.' });
    setImmediate(() => process.exit(1));
  }
});
