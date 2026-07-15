import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CursorQueryDto } from './dto/cursor-query.dto';
import { parseCursor, encodeCursor } from '../common/utils/cursor-pagination';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async likePost(postId: string, userId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.postLike.createMany({
        data: [{ postId, userId }],
        skipDuplicates: true,
      });

      if (result.count === 1) {
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        });
      }
    });

    return { ok: true };
  }

  async unlikePost(postId: string, userId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.postLike.deleteMany({
        where: { postId, userId },
      });

      if (result.count === 1) {
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        });
      }
    });

    return { ok: true };
  }

  async getPostLikes(postId: string, userId: string, query: CursorQueryDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Post not found');
    }

    const limit = query.limit ?? 20;
    const cursor = parseCursor(query.cursor);

    const where: any = {
      postId,
      ...this.buildLikeCursorWhere(cursor, 'asc'),
    };

    const likes = await this.prisma.postLike.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = likes.length > limit;
    const items = hasMore ? likes.slice(0, limit) : likes;
    const nextCursor = hasMore
      ? encodeCursor(
          items[items.length - 1].userId,
          items[items.length - 1].createdAt,
        )
      : null;

    return {
      items: items.map((l) => l.user),
      nextCursor,
    };
  }

  async likeComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: comment.postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.commentLike.createMany({
        data: [{ commentId, userId }],
        skipDuplicates: true,
      });

      if (result.count === 1) {
        await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        });
      }
    });

    return { ok: true };
  }

  async unlikeComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: comment.postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.commentLike.deleteMany({
        where: { commentId, userId },
      });

      if (result.count === 1) {
        await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
        });
      }
    });

    return { ok: true };
  }

  async getCommentLikes(
    commentId: string,
    userId: string,
    query: CursorQueryDto,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: comment.postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      throw new NotFoundException('Comment not found');
    }

    const limit = query.limit ?? 20;
    const cursor = parseCursor(query.cursor);

    const where: any = {
      commentId,
      ...this.buildLikeCursorWhere(cursor, 'asc'),
    };

    const likes = await this.prisma.commentLike.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = likes.length > limit;
    const items = hasMore ? likes.slice(0, limit) : likes;
    const nextCursor = hasMore
      ? encodeCursor(
          items[items.length - 1].userId,
          items[items.length - 1].createdAt,
        )
      : null;

    return {
      items: items.map((l) => l.user),
      nextCursor,
    };
  }

  private buildLikeCursorWhere(
    cursor: { id: string; createdAt: string } | null,
    order: 'asc' | 'desc',
  ): any {
    if (!cursor) return {};

    const dateCondition = order === 'asc' ? 'gt' : 'lt';
    const idCondition = order === 'asc' ? 'gt' : 'lt';

    return {
      OR: [
        { createdAt: { [dateCondition]: new Date(cursor.createdAt) } },
        {
          createdAt: new Date(cursor.createdAt),
          userId: { [idCondition]: cursor.id },
        },
      ],
    };
  }
}
