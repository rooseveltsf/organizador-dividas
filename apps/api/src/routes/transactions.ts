import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController';

const router = Router();

/**
 * GET /transactions
 * Query params obrigatório: ?profileId=UUID
 * Query params opcionais: ?month=10&year=2026&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/', TransactionController.list);

/**
 * POST /transactions
 * Criação com validação Zod e suporte a:
 * - profileId obrigatório
 * - parcelas automáticas se category === 'installment'
 * - projeções fixas e recorrentes por repeatMonths se category === 'fixed' | 'recurring'
 */
router.post('/', TransactionController.create);

/**
 * POST /transactions/batch
 * Criação em lote de transações atômica (ex: contracheque) com projeção de meses futuros
 */
router.post('/batch', TransactionController.batchCreate);

/**
 * PATCH /transactions/:id/status
 * Alterna status entre 'pending' e 'paid' (ou define status enviado) com auto-preenchimento de paymentDate
 */
router.patch('/:id/status', TransactionController.updateStatus);

/**
 * PUT /transactions/:id
 * Atualização dos dados da transação com UpdateTransactionDTO
 */
router.put('/:id', TransactionController.update);

/**
 * PATCH /transactions/:id
 * Atualização parcial dos dados da transação
 */
router.patch('/:id', TransactionController.update);

/**
 * DELETE /transactions/:id
 * Query params opcionais: ?deleteAll=true
 */
router.delete('/:id', TransactionController.delete);

export default router;
