import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must not exceed 254 characters')
    .transform((email) => email.toLowerCase()),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name must not exceed 100 characters'),
}).strict();

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must not exceed 254 characters')
    .transform((email) => email.toLowerCase()),

  password: z
    .string()
    .min(1, 'Password is required')
    .max(72, 'Invalid email or password'),
}).strict();

export const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email must not exceed 254 characters')
    .transform((email) => email.toLowerCase()),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),

  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
}).strict();

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
}).strict();
