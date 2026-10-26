import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import {
  ApiResponse,
  CreateTransactionDTO,
  Transaction as SharedTransaction
} from '@organizador/shared';

// Instância do Prisma Client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

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

// Rotas de Transações (Prontas para expansão)
app.get('/api/transactions', async (_req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
    });

    const response: ApiResponse<typeof transactions> = {
      success: true,
      data: transactions,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Erro ao buscar transações.',
      errors: [error instanceof Error ? error.message : 'Erro interno desconhecido'],
    };
    res.status(500).json(response);
  }
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreateTransactionDTO;

    const transaction = await prisma.transaction.create({
      data: {
        type: payload.type,
        category: payload.category,
        amount: payload.amount,
        description: payload.description,
        date: new Date(payload.date),
        currentInstallment: payload.currentInstallment,
        totalInstallments: payload.totalInstallments,
        groupId: payload.groupId,
        status: payload.status || 'pending',
        paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : null,
      },
    });

    const response: ApiResponse<typeof transaction> = {
      success: true,
      data: transaction,
      message: 'Transação criada com sucesso.',
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Erro ao criar transação.',
      errors: [error instanceof Error ? error.message : 'Erro interno desconhecido'],
    };
    res.status(400).json(response);
  }
});

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
