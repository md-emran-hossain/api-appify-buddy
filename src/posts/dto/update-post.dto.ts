import { z } from 'zod';
import { PostVisibility } from '@prisma/client';

export const UpdatePostSchema = z.object({
  text: z.string().max(5000).optional(),
  visibility: z.nativeEnum(PostVisibility).optional(),
});

export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;
