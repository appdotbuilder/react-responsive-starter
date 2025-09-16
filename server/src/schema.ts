import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(['admin', 'user']),
  is_active: z.boolean(),
  email_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Public user info (without sensitive data)
export const publicUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(['admin', 'user']),
  is_active: z.boolean(),
  email_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PublicUser = z.infer<typeof publicUserSchema>;

// Authentication schemas
export const signupInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1)
});

export type SignupInput = z.infer<typeof signupInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Session schema
export const sessionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  token: z.string(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type Session = z.infer<typeof sessionSchema>;

// User profile update schema
export const updateProfileInputSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

// Change password schema
export const changePasswordInputSchema = z.object({
  current_password: z.string(),
  new_password: z.string().min(8)
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

// Dashboard data schema
export const dashboardDataSchema = z.object({
  user: publicUserSchema,
  stats: z.object({
    total_logins: z.number(),
    last_login: z.coerce.date().nullable(),
    account_created: z.coerce.date()
  })
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;

// Landing page content schema
export const landingPageContentSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  features: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string()
  })),
  call_to_action: z.object({
    title: z.string(),
    description: z.string(),
    button_text: z.string()
  })
});

export type LandingPageContent = z.infer<typeof landingPageContentSchema>;