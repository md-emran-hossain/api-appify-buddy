import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BullMQService, PostCleanupJob } from './bullmq.service';

@Injectable()
export class QueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private readonly bullmq: BullMQService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('app.nodeEnv') === 'test') return;

    this.bullmq.startWorker({
      processor: (job) => this.processJob(job),
      onFailed: (job, err) => this.onJobFailed(job, err),
    });
    this.logger.log('Queue processor initialized');
  }

  private async processJob(job: Job<PostCleanupJob>): Promise<void> {
    const { postId, imageStorageKey, visibility } = job.data;

    // Idempotency: check if post still exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, erasedAt: true },
    });

    // Already anonymized/hard-deleted — nothing to do
    if (!post || post.erasedAt) {
      this.logger.log(`Post ${postId} already cleaned up, skipping`);
      return;
    }

    // Delete image from storage (idempotent — Supabase ignores missing)
    if (imageStorageKey) {
      await this.storage.deleteFile(imageStorageKey);
    }

    if (visibility === 'PRIVATE') {
      await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.deleteMany({
          where: { comment: { postId } },
        });
        await tx.comment.deleteMany({
          where: { postId },
        });
        await tx.postLike.deleteMany({
          where: { postId },
        });
        await tx.post.delete({
          where: { id: postId },
        });
      });
      this.logger.log(`Hard-deleted private post ${postId}`);
    } else {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.commentLike.deleteMany({
          where: { comment: { postId } },
        });
        await tx.comment.updateMany({
          where: { postId, erasedAt: null },
          data: {
            authorId: null,
            text: '[deleted]',
            erasedAt: now,
          },
        });
        await tx.postLike.deleteMany({
          where: { postId },
        });
        await tx.post.update({
          where: { id: postId },
          data: {
            authorId: null,
            text: '[deleted]',
            imageUrl: null,
            imageStorageKey: null,
            erasedAt: now,
          },
        });
      });
      this.logger.log(`Anonymized public post ${postId} and its comments`);
    }
  }

  private onJobFailed(job: Job<PostCleanupJob> | undefined, err: Error): void {
    const postId = job?.data.postId ?? 'unknown';
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 5;

    this.logger.error(
      `Cleanup job failed postId=${postId} attempt=${attempt}/${maxAttempts}: ${err.message}`,
    );

    // Permanent failure — all retries exhausted
    if (job && attempt >= maxAttempts) {
      this.logger.error(
        `PERMANENT FAILURE: Post ${postId} cleanup failed after ${maxAttempts} attempts. Manual intervention required.`,
      );
    }
  }
}
