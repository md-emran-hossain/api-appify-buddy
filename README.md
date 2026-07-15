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
npm install
cp .env.example .env
npm run prisma:deploy
npm run prisma:generate
npm run start:dev
```

`http://localhost:4000/api/v1/health`
