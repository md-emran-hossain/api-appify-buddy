import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BullMQService } from '../queue/bullmq.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import {
  parseCursor,
  encodeCursor,
  buildCursorWhere,
} from '../common/utils/cursor-pagination';
import { PostVisibility } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bullmq: BullMQService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    authorId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ) {
    if (!dto.text && !file) {
      throw new BadRequestException(
        'At least one of text or image is required',
      );
    }

    const postId = this.generateCuid();
    let imageUrl: string | undefined;
    let imageStorageKey: string | undefined;

    if (file) {
      const uploaded = await this.storageService.uploadPostImage(
        authorId,
        postId,
        file,
      );
      imageUrl = uploaded.url;
      imageStorageKey = uploaded.storageKey;
    }

    const post = await this.prisma.post.create({
      data: {
        id: postId,
        authorId,
        text: dto.text,
        imageUrl,
        imageStorageKey,
        visibility: dto.visibility,
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

    return post;
  }

  async feed(userId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const cursor = parseCursor(query.cursor);

    const where: any = {
      deletedAt: null,
      OR: [{ visibility: PostVisibility.PUBLIC }, { authorId: userId }],
      ...buildCursorWhere(cursor, 'desc'),
    };

    const posts = await this.prisma.post.findMany({
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

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore
      ? encodeCursor(
          items[items.length - 1].id,
          items[items.length - 1].createdAt,
        )
      : null;

    const postIds = items.map((p) => p.id);

    const likedByMe = await this.prisma.postLike.findMany({
      where: { postId: { in: postIds }, userId },
      select: { postId: true },
    });

    const likedByMeSet = new Set(likedByMe.map((l) => l.postId));

    const previewResults = await Promise.all(
      postIds.map((postId) =>
        this.prisma.postLike.findMany({
          where: { postId },
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
    postIds.forEach((id, i) => previewMap.set(id, previewResults[i]));

    const result = items.map((post) => ({
      ...post,
      likedByMe: likedByMeSet.has(post.id),
      likedByPreview: (previewMap.get(post.id) ?? []).map((l) => l.user),
    }));

    return { items: result, nextCursor };
  }

  async findOne(postId: string, userId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
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

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (
      post.visibility === PostVisibility.PRIVATE &&
      post.authorId !== userId
    ) {
      throw new NotFoundException('Post not found');
    }

    const likedByMe = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    return { ...post, likedByMe: !!likedByMe };
  }

  async update(postId: string, authorId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
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
  }

  async remove(postId: string, authorId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.authorId !== authorId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });

      await tx.comment.updateMany({
        where: { postId },
        data: { deletedAt: new Date() },
      });
    });

    await this.bullmq.addPostCleanupJob({
      postId: post.id,
      imageStorageKey: post.imageStorageKey,
      visibility: post.visibility,
    });

    return { ok: true };
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `c${timestamp}${random}`;
  }
}
