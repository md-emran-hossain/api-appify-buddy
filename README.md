# Appify Buddy API

REST API backend for a social feed application built with NestJS and Prisma.

## Features

- Authentication (email/password + Google OAuth)
- Posts (text & image, public/private visibility)
- Comments & replies (one-level deep)
- Likes (posts, comments, replies)
- Image uploads via Supabase Storage
- Rate limiting (Redis-backed)
- Health checks

## Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- Supabase account (for image storage)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env` values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct PostgreSQL connection string (for migrations) |
| `REDIS_URL` | Redis connection string (`redis://:password@host:port`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |

### 3. Run migrations

```bash
npm run prisma:deploy
```

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

### 5. Start the server

```bash
npm run start:dev
```

The API runs on `http://localhost:4000/api/v1`.

### 6. Verify

```bash
curl http://localhost:4000/api/v1/health
```

## Database Migrations

Create a new migration:

```bash
npm run prisma:migrate -- --name <migration_name>
```

Apply pending migrations:

```bash
npm run prisma:deploy
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start dev server with hot-reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
