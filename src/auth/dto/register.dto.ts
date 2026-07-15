import { z } from 'zod';

export const RegisterSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
      'Password must be at least 8 characters with uppercase, lowercase, number, and symbol',
    ),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
