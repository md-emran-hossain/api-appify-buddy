import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';

export const DELETE_POST_QUEUE = 'delete-post';

export interface PostCleanupJob {
  postId: string;
  imageStorageKey?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
}

export interface WorkerCallbacks {
  processor: (job: Job<PostCleanupJob>) => Promise<void>;
  onFailed?: (job: Job<PostCleanupJob> | undefined, err: Error) => void;
}

@Injectable()
export class BullMQService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMQService.name);
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('app.redisUrl');

    this.queue = new Queue(DELETE_POST_QUEUE, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.logger.log('BullMQ queue initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
  }

  async addPostCleanupJob(job: PostCleanupJob): Promise<void> {
    await this.queue.add('post.cleanup', job, {
      jobId: `post-cleanup:${job.postId}`,
    });
    this.logger.log(`Enqueued post cleanup job for postId=${job.postId}`);
  }

  startWorker(callbacks: WorkerCallbacks): void {
    const redisUrl = this.configService.get<string>('app.redisUrl');

    this.worker = new Worker(
      DELETE_POST_QUEUE,
      async (job) => {
        this.logger.log(
          `Processing post cleanup job postId=${job.data.postId} attempt=${job.attemptsMade + 1}`,
        );
        await callbacks.processor(job);
      },
      {
        connection: { url: redisUrl },
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      callbacks.onFailed?.(job as Job<PostCleanupJob>, err);
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Job completed postId=${job.data.postId}`);
    });

    this.logger.log('BullMQ worker started');
  }
}
