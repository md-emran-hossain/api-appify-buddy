import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthCheck {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  frontendOrigin: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'error';

    if (status === 'error') {
      this.logger.error('Health check failed', { database, redis });
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      frontendOrigin: this.configService.get<string>('app.frontendOrigin') ?? 'not set',
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const client = this.redis.getClient();
      await client.ping();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
