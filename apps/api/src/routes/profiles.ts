import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';

const router = Router();

/**
 * GET /profiles
 * Lista todos os perfis com contagem de pendências do mês vigente
 */
router.get('/', ProfileController.list);

/**
 * POST /profiles
 * Criação de perfil com validação Zod e geração automática de iniciais
 */
router.post('/', ProfileController.create);

/**
 * PUT /profiles/:id
 * Atualização dos dados cadastrais do perfil (nome e cores)
 */
router.put('/:id', ProfileController.update);

/**
 * DELETE /profiles/:id
 * Remoção do perfil com exclusão em cascata das transações vinculadas
 */
router.delete('/:id', ProfileController.delete);

export default router;

