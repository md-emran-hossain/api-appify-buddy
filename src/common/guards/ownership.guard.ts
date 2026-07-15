import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    const params = request.params;
    const body = request.body;

    const resourceType = body?._resourceType as
      | 'post'
      | 'comment'
      | undefined;

    if (!resourceType) {
      return true;
    }

    let ownerId: string | null = null;

    if (resourceType === 'post') {
      const postId = params.postId ?? body.postId;
      if (!postId) return true;
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
      ownerId = post?.authorId ?? null;
    } else if (resourceType === 'comment') {
      const commentId = params.commentId ?? body.commentId;
      if (!commentId) return true;
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { authorId: true },
      });
      ownerId = comment?.authorId ?? null;
    }

    if (ownerId && ownerId !== userId) {
      throw new ForbiddenException('You can only modify your own resources');
    }

    return true;
  }
}
