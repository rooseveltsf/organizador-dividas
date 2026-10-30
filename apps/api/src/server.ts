import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  ApiResponse,
} from '@organizador/shared';

import transactionRouter from './routes/transactions';
import profileRouter from './routes/profiles';
import payslipRouter from './routes/payslip';

import { prisma } from './prisma';
export { prisma };

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de Health Check
app.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ uptime: number; timestamp: string }> = {
    success: true,
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    message: 'API do Organizador de Dívidas operacional.',
  };
  res.json(response);
});

// Rotas de Transações
app.use('/transactions', transactionRouter);
app.use('/api/transactions', transactionRouter);

// Rotas de Perfis de Usuário
app.use('/profiles', profileRouter);
app.use('/api/profiles', profileRouter);

// Rotas de Leitura e Importação de Holerites (Contracheques em PDF)
app.use('/payslip', payslipRouter);
app.use('/api/payslip', payslipRouter);

// Inicialização do servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check disponível em http://localhost:${PORT}/health`);
});

// Encerramento gracioso das conexões
async function gracefulShutdown(signal: string) {
  console.log(`\nRecebido ${signal}. Encerrando servidor e conexões do Prisma...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Conexões encerradas com sucesso.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
