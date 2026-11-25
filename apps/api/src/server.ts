import 'dotenv/config';
import app from './app';
import { prisma } from './prisma';
export { prisma };

const PORT = process.env.PORT || 3000;

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
