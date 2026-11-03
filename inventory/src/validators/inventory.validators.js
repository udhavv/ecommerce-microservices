import { z } from 'zod';

export const createInventorySchema = z.object({
  product_id: z.coerce.number().int().positive('Product ID must be a positive integer'),
  variant_id: z.coerce.number().int().positive('Variant ID must be a positive integer'),
  sku: z.string().trim().max(100).optional().nullable(),
  quantity_available: z.coerce.number().int().min(0, 'Quantity available cannot be negative').default(0),
  low_stock_threshold: z.coerce.number().int().min(0, 'Low stock threshold cannot be negative').default(5),
});

export const adjustStockSchema = z.object({
  // Can either provide delta (quantity_change) or absolute target (new_quantity)
  quantity_change: z.coerce.number().int().optional(),
  new_quantity: z.coerce.number().int().min(0).optional(),
  movement_type: z
    .enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN'])
    .default('ADJUSTMENT'),
  reason: z.string().trim().max(500).optional().nullable(),
  reference_id: z.string().trim().max(64).optional().nullable(),
}).refine(
  (data) => data.quantity_change !== undefined || data.new_quantity !== undefined,
  {
    message: 'Either quantity_change or new_quantity must be provided.',
  }
);

export const reserveStockSchema = z.object({
  order_id: z.string().trim().min(1, 'Order ID is required').max(64),
  items: z
    .array(
      z.object({
        variant_id: z.coerce.number().int().positive('Variant ID must be positive'),
        quantity: z.coerce.number().int().min(1, 'Quantity to reserve must be at least 1'),
      })
    )
    .min(1, 'At least one item must be reserved'),
  expires_in_minutes: z.coerce.number().int().min(1).max(1440).default(15),
  idempotency_key: z.string().trim().max(128).optional().nullable(),
});

export const confirmReservationSchema = z.object({
  order_id: z.string().trim().min(1, 'Order ID is required').max(64),
  order_number: z.string().trim().max(64).optional().nullable(),
});

export const releaseReservationSchema = z.object({
  order_id: z.string().trim().min(1, 'Order ID is required').max(64),
  order_number: z.string().trim().max(64).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        variant_id: z.coerce.number().int().positive().optional(),
        variantId: z.coerce.number().int().positive().optional(),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .optional()
    .nullable(),
});

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  low_stock_only: z.coerce.boolean().optional(),
  seller_id: z.string().uuid().optional(),
});
