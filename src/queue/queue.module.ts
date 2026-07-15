import { Module } from '@nestjs/common';
import { BullMQService } from './bullmq.service';
import { QueueProcessor } from './queue.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [BullMQService, QueueProcessor],
  exports: [BullMQService],
})
export class QueueModule {}
