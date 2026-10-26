import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController';

const router = Router();

/**
 * GET /transactions
 * Query params opcionais: ?month=10&year=2026
 */
router.get('/', TransactionController.list);

/**
 * POST /transactions
 * Criação com suporte a parcelas automáticas se category === 'installment'
 */
router.post('/', TransactionController.create);

/**
 * DELETE /transactions/:id
 * Query params opcionais: ?deleteAll=true
 */
router.delete('/:id', TransactionController.delete);

export default router;
