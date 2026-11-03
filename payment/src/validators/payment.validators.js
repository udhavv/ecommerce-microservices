import { z } from 'zod';

export const processPaymentSchema = z.object({
  order_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  order_number: z.string().min(3, 'Order number is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  currency: z.string().length(3).default('USD'),
  payment_method: z
    .enum(['MOCK_CARD', 'MOCK_WALLET', 'MOCK_UPI', 'MOCK_NETBANKING', 'CASH_ON_DELIVERY'])
    .default('MOCK_CARD'),
  card_number: z.string().optional(),
  expiry: z.string().optional(),
  cvv: z.string().optional(),
  mock_action: z
    .enum(['SUCCESS', 'DECLINE', 'INSUFFICIENT_FUNDS', 'EXPIRED_CARD', 'NETWORK_TIMEOUT'])
    .default('SUCCESS'),
  idempotency_key: z.string().max(128).optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(3, 'Refund reason is required').default('Customer requested refund'),
});

export const listPaymentsQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z.string().optional().transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  status: z.string().optional(),
  order_id: z.string().optional(),
  user_id: z.string().optional(),
  payment_method: z.string().optional(),
  sort_by: z.string().optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  processPaymentSchema,
  refundPaymentSchema,
  listPaymentsQuerySchema,
};
