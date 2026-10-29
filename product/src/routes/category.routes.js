import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.validators.js';

const router = Router();

router.use(authenticate);

// Public Category Endpoints
router.get('/', categoryController.listCategories);
router.get('/:idOrSlug', categoryController.getCategory);

// Protected Category Endpoints (Admin & Seller can create, Admin can update/delete)
router.post(
  '/',
  requireAuth,
  requireRole(['admin', 'seller']),
  validate(createCategorySchema),
  categoryController.createCategory
);

router.put(
  '/:id',
  requireAuth,
  requireRole(['admin']),
  validate(updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['admin']),
  categoryController.deleteCategory
);

export default router;
