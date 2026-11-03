import { z } from 'zod';

const addressSchema = z.object({
  street: z.string().min(2, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State / Province is required'),
  postal_code: z.string().min(2, 'Postal code is required'),
  country: z.string().min(2, 'Country code or name is required'),
  phone: z.string().min(10, 'phone number is required'),
});

const orderItemInputSchema = z.object({
  product_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  variant_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Maximum 100 units per item'),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item'),
  shipping_address: addressSchema,
  billing_address: addressSchema.optional(),
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional(),
  idempotency_key: z.string().max(128).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
  ]),
  reason: z.string().optional(),
  tracking_number: z.string().optional(),
});

export const payOrderSchema = z.object({
  payment_method: z.string().default('CREDIT_CARD'),
  transaction_id: z.string().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3, 'A cancellation reason is required').default('Customer requested cancellation'),
});

export const listOrdersQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z.string().optional().transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  status: z.string().optional(),
  payment_status: z.string().optional(),
  user_id: z.string().optional(),
  seller_id: z.string().optional(),
  as_seller: z.union([z.string(), z.boolean()]).optional(),
  search: z.string().optional(),
  sort_by: z.string().optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  createOrderSchema,
  updateOrderStatusSchema,
  payOrderSchema,
  cancelOrderSchema,
  listOrdersQuerySchema,
};
