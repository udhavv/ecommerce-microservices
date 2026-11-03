import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createInventorySchema,
  adjustStockSchema,
  reserveStockSchema,
  confirmReservationSchema,
  releaseReservationSchema,
  listInventoryQuerySchema,
} from '../validators/inventory.validators.js';

const router = Router();

router.use(authenticate);

// Public / Catalog Stock Read Endpoints
router.get('/variant/:variantId', inventoryController.getByVariantId);
router.get('/product/:productId', inventoryController.getByProductId);

// Protected Seller & Admin Management Endpoints
router.get(
  '/',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(listInventoryQuerySchema, 'query'),
  inventoryController.listInventory
);

router.post(
  '/',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(createInventorySchema),
  inventoryController.createInventoryItem
);

router.patch(
  '/:id/stock',
  requireAuth,
  requireRole(['seller', 'admin']),
  validate(adjustStockSchema),
  inventoryController.adjustStock
);

router.delete(
  '/product/:productId',
  requireAuth,
  requireRole(['seller', 'admin']),
  inventoryController.deleteByProductId
);

router.get(
  '/movements/:variantId',
  requireAuth,
  requireRole(['seller', 'admin']),
  inventoryController.listMovements
);

// Order Service / Checkout Flow Endpoints (Reservation & Settlement)
router.post(
  '/reserve',
  requireAuth,
  validate(reserveStockSchema),
  inventoryController.reserveStock
);

router.post(
  '/confirm',
  requireAuth,
  validate(confirmReservationSchema),
  inventoryController.confirmReservation
);

router.post(
  '/release',
  requireAuth,
  validate(releaseReservationSchema),
  inventoryController.releaseReservation
);

export default router;
