import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { ApiResponse } from '@organizador/shared';
import transactionRouter from './routes/transactions';
import profileRouter from './routes/profiles';
import payslipRouter from './routes/payslip';

const invalidJson: ErrorRequestHandler = (error, _req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Corpo JSON inválido.' });
    return;
  }
  next(error);
};

export function createApp(desktop?: { credential: string; webRoot: string }) {
  const app = express();
  app.disable('x-powered-by');
  if (desktop) {
    const credential = Buffer.from(desktop.credential);
    app.use((req, res, next) => {
      if (req.get('Host') !== `127.0.0.1:${req.socket.localPort}`) {
        res.sendStatus(403);
        return;
      }
      res.set({
        'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' blob:; " +
          "worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      });
      next();
    });
    app.use('/api', (req, res, next) => {
      const supplied = Buffer.from(req.get('X-Organizador-Desktop') ?? '');
      const origin = req.get('Origin');
      if (supplied.length !== credential.length || !timingSafeEqual(supplied, credential) ||
          (origin && origin !== `http://127.0.0.1:${req.socket.localPort}`)) {
        res.status(403).json({ success: false, message: 'Pedido local não autorizado.' });
        return;
      }
      next();
    });
  } else {
    app.use(cors());
  }
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json());
  app.use(invalidJson);

  if (!desktop) {
    app.get('/health', (_req, res) => {
      const response: ApiResponse<{ uptime: number; timestamp: string }> = {
        success: true,
        data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
        message: 'API do Caderno de Dívidas operacional.',
      };
      res.json(response);
    });
  }
  for (const [name, router] of Object.entries({ transactions: transactionRouter, profiles: profileRouter, payslip: payslipRouter })) {
    app.use(desktop ? `/api/${name}` : [`/${name}`, `/api/${name}`], router);
  }

  if (desktop) {
    app.use(['/api', '/transactions', '/profiles', '/payslip', '/health'], (_req, res) => res.sendStatus(404));
    const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));
    for (const directory of ['cmaps', 'iccs', 'standard_fonts', 'wasm']) {
      app.use(`/pdf-resources/${directory}`, express.static(join(pdfRoot, directory), { redirect: false }));
    }
    app.use(express.static(desktop.webRoot, { redirect: false }));
  }
  return app;
}

export default createApp();
