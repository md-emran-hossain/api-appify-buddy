import { z } from 'zod';

export const CursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type CursorQueryDto = z.infer<typeof CursorQuerySchema>;
