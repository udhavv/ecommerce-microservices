import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  payOrderSchema,
  cancelOrderSchema,
  listOrdersQuerySchema,
} from '../validators/order.validators.js';

const router = Router();

// Apply auth extraction to all routes
router.use(authenticate);

// Orders List & Lookup
router.get(
  '/',
  requireAuth,
  validate(listOrdersQuerySchema, 'query'),
  orderController.listOrders
);

router.get(
  '/number/:orderNumber',
  requireAuth,
  orderController.getOrderByNumber
);

router.get(
  '/:id',
  requireAuth,
  orderController.getOrderById
);

// Order Creation
router.post(
  '/',
  requireAuth,
  validate(createOrderSchema),
  orderController.createOrder
);

// Payment & Settlement
router.post(
  '/:id/pay',
  requireAuth,
  validate(payOrderSchema),
  orderController.payOrder
);

// Cancellation
router.post(
  '/:id/cancel',
  requireAuth,
  validate(cancelOrderSchema),
  orderController.cancelOrder
);

// Admin & Seller Status Progression (PROCESSING, SHIPPED, DELIVERED)
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(['admin', 'seller']),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

export default router;
