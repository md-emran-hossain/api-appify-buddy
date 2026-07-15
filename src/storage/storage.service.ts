import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const IMAGE_SIZE = 1000;
const IMAGE_QUALITY = 80;

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('app.supabaseUrl') ?? '';
    const key = this.configService.get<string>('app.supabaseSecretKey') ?? '';
    this.supabase = createClient(url, key);
    this.bucket =
      this.configService.get<string>('app.supabaseStorageBucket') ??
      'post-images';
    const maxMb = this.configService.get<number>('app.maxImageSizeMb') ?? 10;
    this.maxFileSizeBytes = maxMb * 1024 * 1024;
  }

  validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File too large. Max size: ${this.maxFileSizeBytes / 1024 / 1024}MB`,
      );
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();
  }

  async uploadPostImage(
    userId: string,
    postId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; storageKey: string }> {
    this.validateFile(file);

    const processed = await this.processImage(file.buffer);
    const storageKey = `${userId}/${postId}/${randomUUID()}.webp`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(storageKey, processed, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (error) {
      this.logger.error('Supabase upload failed', error);
      throw new BadRequestException('Failed to upload image');
    }

    const { data: urlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(storageKey);

    return { url: urlData.publicUrl, storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      this.logger.error('Supabase delete failed', error);
    }
  }
}
