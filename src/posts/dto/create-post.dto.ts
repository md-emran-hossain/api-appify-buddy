import { z } from 'zod';
import { PostVisibility } from '@prisma/client';

export const CreatePostSchema = z.object({
  text: z.string().max(5000).optional(),
  visibility: z.nativeEnum(PostVisibility),
});

export type CreatePostDto = z.infer<typeof CreatePostSchema>;
