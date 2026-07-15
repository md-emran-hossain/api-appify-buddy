# Appify Buddy API

REST API for a social feed application — users can create posts, comment, like, and share images.

## What It Does

- **Auth** — Email/password registration and Google OAuth. Tokens are delivered as httpOnly cookies with refresh rotation.
- **Posts** — Create text or image posts, public or private. Cursor-based feed with like previews.
- **Comments** — Threaded comments with one-level-deep replies.
- **Likes** — Like posts and comments with atomic counters.
- **Images** — Upload via Supabase Storage, auto-processed to WebP.
- **Background Jobs** — Post deletion cleanup handled asynchronously with BullMQ.

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | NestJS |
| Database | PostgreSQL + Prisma |
| Cache & Queue | Redis + BullMQ |
| Storage | Supabase Storage |
| Auth | Passport.js (JWT + Google OAuth) |
| Validation | Zod |

## Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- Supabase account (for image storage)

## Getting Started

```bash
# Install
npm install

# Configure
cp .env.example .env
# Fill in your values

# Migrate & generate client
npm run prisma:deploy
npm run prisma:generate

# Start dev server
npm run start:dev
```

API runs at `http://localhost:4000/api/v1`.

Verify: `curl http://localhost:4000/api/v1/health`

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection (port 6543 for Supabase) |
| `DIRECT_URL` | PostgreSQL direct connection (port 5432, for migrations) |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `FRONTEND_ORIGIN` | Allowed CORS origin (e.g. `https://your-app.vercel.app`) |
| `COOKIE_DOMAIN` | Cookie domain |

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Dev server with hot-reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |

## Database

```bash
# Create a new migration
npm run prisma:migrate -- --name <migration_name>

# Apply pending migrations
npm run prisma:deploy

# Open Prisma Studio
npm run prisma:studio
```

## Deploying

On Render or similar platforms, set:

- **Build Command:** `npm install && npm run build && npm run prisma:generate`
- **Start Command:** `npm run prisma:deploy && npm run start:prod`

Make sure `DATABASE_URL` uses port 6543 (pooled) and `DIRECT_URL` uses port 5432 (direct) if you're on Supabase.
