import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { ApiResponse } from '@organizador/shared';
import transactionRouter from './routes/transactions';
import profileRouter from './routes/profiles';
import payslipRouter from './routes/payslip';

const app = express();
app.use(cors());
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json());

const invalidJson: ErrorRequestHandler = (error, _req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Corpo JSON inválido.' });
    return;
  }
  next(error);
};
app.use(invalidJson);

app.get('/health', (_req, res) => {
  const response: ApiResponse<{ uptime: number; timestamp: string }> = {
    success: true,
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
    message: 'API do Organizador de Dívidas operacional.',
  };
  res.json(response);
});

app.use(['/transactions', '/api/transactions'], transactionRouter);
app.use(['/profiles', '/api/profiles'], profileRouter);
app.use(['/payslip', '/api/payslip'], payslipRouter);

export default app;
