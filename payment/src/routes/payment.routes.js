import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  processPaymentSchema,
  refundPaymentSchema,
  listPaymentsQuerySchema,
} from '../validators/payment.validators.js';

const router = Router();

router.use(authenticate);

// Process a mock payment
router.post(
  '/process',
  requireAuth,
  validate(processPaymentSchema),
  paymentController.processPayment
);

// Admin Refund
router.post(
  '/:id/refund',
  requireAuth,
  requireRole(['admin']),
  validate(refundPaymentSchema),
  paymentController.refundPayment
);

// List Payments
router.get(
  '/',
  requireAuth,
  validate(listPaymentsQuerySchema, 'query'),
  paymentController.listPayments
);

// Get Payment by Order ID
router.get(
  '/order/:orderId',
  requireAuth,
  paymentController.getPaymentByOrderId
);

// Get Payment by ID
router.get(
  '/:id',
  requireAuth,
  paymentController.getPaymentById
);

export default router;
