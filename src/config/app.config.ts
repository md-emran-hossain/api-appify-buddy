import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,

  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtlSeconds: parseInt(
    process.env.ACCESS_TOKEN_TTL_SECONDS || '900',
    10,
  ),
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'post-images',

  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:4000/api/v1/auth/google/callback',

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10),
}));
