import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((val) => val.trim().toLowerCase()),
  password: z.string(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
