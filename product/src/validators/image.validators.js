import { z } from 'zod';

export const createImageSchema = z.object({
  image_url: z.string().trim().url('Must be a valid URL'),
  alt_text: z.string().trim().max(255).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  is_primary: z.boolean().optional().default(false),
  variant_id: z.coerce.number().int().positive().optional().nullable(),
});

export const updateImageSchema = z.object({
  image_url: z.string().trim().url().optional(),
  alt_text: z.string().trim().max(255).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_primary: z.boolean().optional(),
  variant_id: z.coerce.number().int().positive().optional().nullable(),
});
