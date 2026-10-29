import { z } from 'zod';

export const createVariantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  variant_name: z.string().trim().max(160).optional().nullable(),
  attributes: z.record(z.any()).optional().default({}),
  price: z.coerce.number().min(0, 'Price must be greater than or equal to 0'),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-character ISO code')
    .toUpperCase()
    .optional()
    .default('USD'),
  is_active: z.boolean().optional().default(true),
});

export const updateVariantSchema = z.object({
  sku: z.string().trim().min(1).max(100).optional(),
  variant_name: z.string().trim().max(160).optional().nullable(),
  attributes: z.record(z.any()).optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  is_active: z.boolean().optional(),
});
