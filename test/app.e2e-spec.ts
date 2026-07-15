import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('/health (GET) should return status object', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('checks');
          expect(res.body.checks).toHaveProperty('database');
          expect(res.body.checks).toHaveProperty('redis');
        });
    });
  });

  describe('Auth', () => {
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test-${Date.now()}@example.com`,
      password: 'StrongPass123!',
    };

    it('POST /api/v1/auth/register should create a user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.firstName).toBe(testUser.firstName);
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });

    it('POST /api/v1/auth/register should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /api/v1/auth/login should return tokens in cookies', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(testUser.email);
          const cookies = res.headers['set-cookie'] as unknown as string[];
          expect(cookies).toBeDefined();
          expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
          expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
        });
    });

    it('POST /api/v1/auth/login should reject wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword1!' })
        .expect(401);
    });

    it('POST /api/v1/auth/register should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...testUser, email: 'weak@example.com', password: 'weak' })
        .expect(400);
    });
  });
});
