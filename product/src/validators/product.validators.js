import { z } from 'zod';

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(1, 'Product name is required and cannot be empty')
    .max(200, 'Product name must not exceed 200 characters'),
  slug: z
    .string()
    .trim()
    .max(220, 'Slug must not exceed 220 characters')
    .optional(),
  description: z
    .string({ required_error: 'Product description is required' })
    .trim()
    .min(1, 'Product description is required and cannot be empty'),
  brand: z
    .string({ required_error: 'Brand is required' })
    .trim()
    .min(1, 'Brand is required and cannot be empty')
    .max(120, 'Brand must not exceed 120 characters'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  category_ids: z
    .array(z.coerce.number().int().positive(), {
      required_error: 'At least one category is required',
    })
    .min(1, 'At least one category must be selected'),
  price: z.coerce
    .number({ required_error: 'Price is required' })
    .min(0, 'Price must be positive or zero'),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be 3-letter code (e.g. USD)')
    .toUpperCase()
    .optional()
    .default('USD'),
  image_url: z
    .string({ required_error: 'Product image is required' })
    .trim()
    .url('Must be a valid image URL'),
  public_id: z.string().trim().optional(),
  initial_stock: z.coerce.number().int().min(0, 'Initial stock cannot be negative').optional().default(10),
  low_stock_threshold: z.coerce.number().int().min(0).optional().default(5),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(1, 'SKU is required').max(100),
        variant_name: z.string().trim().max(160).optional().nullable(),
        attributes: z.record(z.any()).optional().default({}),
        price: z.coerce.number().min(0, 'Price must be positive or zero'),
        currency: z
          .string()
          .trim()
          .length(3, 'Currency must be 3-letter code (e.g. USD)')
          .toUpperCase()
          .optional()
          .default('USD'),
        is_active: z.boolean().optional().default(true),
      })
    )
    .optional(),
  images: z
    .array(
      z.object({
        image_url: z.string().trim().url('Must be a valid image URL'),
        alt_text: z.string().trim().max(255).optional().nullable(),
        sort_order: z.coerce.number().int().min(0).optional().default(0),
        is_primary: z.boolean().optional().default(false),
      })
    )
    .optional(),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name cannot be empty')
    .max(200, 'Product name must not exceed 200 characters')
    .optional(),
  slug: z
    .string()
    .trim()
    .max(220, 'Slug must not exceed 220 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Product description cannot be empty')
    .optional(),
  brand: z
    .string()
    .trim()
    .min(1, 'Brand cannot be empty')
    .max(120, 'Brand must not exceed 120 characters')
    .optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  category_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Must include at least one category')
    .optional(),
  price: z.coerce.number().min(0, 'Price must be positive or zero').optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  image_url: z.string().trim().url('Must be a valid image URL').optional(),
  public_id: z.string().trim().optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(1, 'SKU is required').max(100),
        variant_name: z.string().trim().max(160).optional().nullable(),
        attributes: z.record(z.any()).optional().default({}),
        price: z.coerce.number().min(0, 'Price must be positive or zero'),
        currency: z
          .string()
          .trim()
          .length(3, 'Currency must be 3-letter code (e.g. USD)')
          .toUpperCase()
          .optional()
          .default('USD'),
        is_active: z.boolean().optional().default(true),
      })
    )
    .optional(),
  images: z
    .array(
      z.object({
        image_url: z.string().trim().url('Must be a valid image URL'),
        alt_text: z.string().trim().max(255).optional().nullable(),
        sort_order: z.coerce.number().int().min(0).optional().default(0),
        is_primary: z.boolean().optional().default(false),
      })
    )
    .optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().optional(),
  seller_id: z.string().uuid().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  brand: z.string().trim().optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  sort_by: z
    .enum(['created_at', 'name', 'price', 'updated_at'])
    .optional()
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});
