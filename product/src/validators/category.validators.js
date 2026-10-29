import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(120, 'Category name must not exceed 120 characters'),
  slug: z
    .string()
    .trim()
    .max(140, 'Slug must not exceed 140 characters')
    .optional(),
  description: z.string().trim().optional().nullable(),
  parent_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name cannot be empty')
    .max(120, 'Category name must not exceed 120 characters')
    .optional(),
  slug: z
    .string()
    .trim()
    .max(140, 'Slug must not exceed 140 characters')
    .optional(),
  description: z.string().trim().optional().nullable(),
  parent_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});
