import { z } from 'zod';

export const createQuestionSchema = z.object({
  product_id: z.coerce.number().int().positive('Product ID must be a positive integer'),
  question: z
    .string()
    .trim()
    .min(5, 'Question must be at least 5 characters')
    .max(1000, 'Question cannot exceed 1,000 characters'),
});

export const createAnswerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(2, 'Answer must be at least 2 characters')
    .max(2000, 'Answer cannot exceed 2,000 characters'),
});

export const listProductQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
