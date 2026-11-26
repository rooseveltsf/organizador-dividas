import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';
import { authorizeProfile } from '../profileAccess';
import shoppingListRouter from './shoppingList';

const router = Router();

const profile = Router({ mergeParams: true });

router.get('/', ProfileController.list);
router.post('/', ProfileController.create);
router.post('/:id/session', ProfileController.enter);
router.delete('/:id/session', ProfileController.leave);

// Monte as rotas com dados do perfil, inclusive planejamento, neste router.
router.use('/:id', authorizeProfile(req => req.params.id), profile);
profile.get('/', ProfileController.details);
profile.put('/', ProfileController.update);
profile.delete('/', ProfileController.delete);
profile.get('/session', ProfileController.status);
profile.put('/pin', ProfileController.updatePin);
profile.use('/shopping-list', shoppingListRouter);

export default router;

