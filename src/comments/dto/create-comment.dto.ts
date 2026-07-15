import { z } from 'zod';

export const CreateCommentSchema = z.object({
  text: z.string().max(2000),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
