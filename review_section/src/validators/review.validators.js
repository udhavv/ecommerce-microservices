import { z } from 'zod';

export const createReviewSchema = z.object({
  product_id: z.coerce.number().int().positive('Product ID must be a positive integer'),
  variant_id: z.coerce.number().int().positive().optional().nullable(),
  order_id: z.coerce.number().int().positive().optional().nullable(),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  title: z.string().trim().max(255, 'Title cannot exceed 255 characters').optional().nullable(),
  comment: z
    .string()
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(5000, 'Review comment cannot exceed 5,000 characters'),
  images: z
    .array(z.string().url('Invalid image URL format'))
    .max(5, 'You can upload a maximum of 5 images per review')
    .optional()
    .default([]),
  idempotency_key: z.string().trim().max(128).optional().nullable(),
});

export const updateReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5')
    .optional(),
  title: z.string().trim().max(255).optional().nullable(),
  comment: z
    .string()
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(5000, 'Review comment cannot exceed 5,000 characters')
    .optional(),
  images: z
    .array(z.string().url('Invalid image URL format'))
    .max(5, 'You can upload a maximum of 5 images')
    .optional(),
});

export const listProductReviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z
    .enum(['newest', 'oldest', 'highest_rating', 'lowest_rating', 'most_helpful'])
    .default('newest'),
  verified_only: z.coerce.boolean().optional(),
  with_images: z.coerce.boolean().optional(),
});

export const voteReviewSchema = z.object({
  vote_type: z.enum(['HELPFUL', 'NOT_HELPFUL'], {
    errorMap: () => ({ message: "Vote type must be either 'HELPFUL' or 'NOT_HELPFUL'" }),
  }),
});

export const reportReviewSchema = z.object({
  reason: z.enum(
    ['SPAM', 'OFFENSIVE', 'FAKE_REVIEW', 'IRRELEVANT', 'INAPPROPRIATE', 'OTHER'],
    {
      errorMap: () => ({ message: 'Please select a valid report reason' }),
    }
  ),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'DELETE']),
  reason: z.string().trim().max(500).optional().nullable(),
});
