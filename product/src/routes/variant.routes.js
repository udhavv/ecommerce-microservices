import { Router } from 'express';
import * as variantController from '../controllers/variant.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { updateVariantSchema } from '../validators/variant.validators.js';

const router = Router();

router.use(authenticate);

router.get('/:id', variantController.getVariant);

router.put(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(updateVariantSchema),
  variantController.updateVariant
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['seller', 'admin']),
  variantController.deleteVariant
);

export default router;
