import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CursorQueryDto } from './dto/cursor-query.dto';
import {
  parseCursor,
  encodeCursor,
  buildCursorWhere,
} from '../common/utils/cursor-pagination';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOnPost(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === 'PRIVATE' && post.authorId !== authorId) {
      throw new NotFoundException('Post not found');
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: { postId, authorId, text: dto.text },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return c;
    });

    return comment;
  }

  async findByPost(postId: string, userId: string, query: CursorQueryDto) {
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
      parentId: null,
      deletedAt: null,
      ...buildCursorWhere(cursor, 'desc'),
    };

    const comments = await this.prisma.comment.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore
      ? encodeCursor(
          items[items.length - 1].id,
          items[items.length - 1].createdAt,
        )
      : null;

    const commentIds = items.map((c) => c.id);

    const likedByMe = await this.prisma.commentLike.findMany({
      where: { commentId: { in: commentIds }, userId },
      select: { commentId: true },
    });

    const likedByMeSet = new Set(likedByMe.map((l) => l.commentId));

    const previewResults = await Promise.all(
      commentIds.map((commentId) =>
        this.prisma.commentLike.findMany({
          where: { commentId },
          take: 3,
          orderBy: { createdAt: 'desc' },
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
        }),
      ),
    );

    const previewMap = new Map<string, (typeof previewResults)[number]>();
    commentIds.forEach((id, i) => previewMap.set(id, previewResults[i]));

    const result = items.map((comment) => ({
      ...comment,
      likedByMe: likedByMeSet.has(comment.id),
      likedByPreview: (previewMap.get(comment.id) ?? []).map((l) => l.user),
    }));

    return { items: result, nextCursor };
  }

  async findReplies(commentId: string, userId: string, query: CursorQueryDto) {
    const parent = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!parent) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: parent.postId, deletedAt: null },
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
      parentId: commentId,
      deletedAt: null,
      ...buildCursorWhere(cursor, 'asc'),
    };

    const replies = await this.prisma.comment.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = replies.length > limit;
    const items = hasMore ? replies.slice(0, limit) : replies;
    const nextCursor = hasMore
      ? encodeCursor(
          items[items.length - 1].id,
          items[items.length - 1].createdAt,
        )
      : null;

    return { items, nextCursor };
  }

  async createReply(
    commentId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    const parent = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!parent) {
      throw new NotFoundException('Comment not found');
    }
    if (parent.parentId !== null) {
      throw new BadRequestException('Cannot reply to a reply');
    }

    const post = await this.prisma.post.findFirst({
      where: { id: parent.postId, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.visibility === 'PRIVATE' && post.authorId !== authorId) {
      throw new NotFoundException('Comment not found');
    }

    const reply = await this.prisma.$transaction(async (tx) => {
      const r = await tx.comment.create({
        data: {
          postId: parent.postId,
          authorId,
          parentId: commentId,
          text: dto.text,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.comment.update({
        where: { id: commentId },
        data: { replyCount: { increment: 1 } },
      });

      await tx.post.update({
        where: { id: parent.postId },
        data: { commentCount: { increment: 1 } },
      });

      return r;
    });

    return reply;
  }

  async update(commentId: string, authorId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { text: dto.text },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async remove(commentId: string, authorId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== authorId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });

      if (!comment.parentId) {
        await tx.comment.updateMany({
          where: { parentId: commentId },
          data: { deletedAt: new Date() },
        });
      }

      const decrement = comment.parentId ? 1 : 1 + (comment.replyCount ?? 0);
      if (comment.parentId) {
        await tx.comment.update({
          where: { id: comment.parentId },
          data: { replyCount: { decrement: 1 } },
        });
      }

      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement } },
      });
    });

    return { ok: true };
  }
}
