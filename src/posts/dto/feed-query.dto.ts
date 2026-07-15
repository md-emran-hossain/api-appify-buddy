import { z } from 'zod';

export const FeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type FeedQueryDto = z.infer<typeof FeedQuerySchema>;
