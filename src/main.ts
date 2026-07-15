import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  const port: string | number = configService.get('app.port') ?? 4000;
  const frontendOrigin = configService.get<string>('app.frontendOrigin');

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
}
bootstrap();
