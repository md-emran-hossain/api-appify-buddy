import { z } from 'zod';

export const UpdateCommentSchema = z.object({
  text: z.string().max(2000),
});

export type UpdateCommentDto = z.infer<typeof UpdateCommentSchema>;
