# Clearplate

Nutrition tracking built around one clear daily equation: **Goal − Food = Left today**.
Goals: sharp thinking, steady energy, fat loss — without guesswork.

## Stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11, Prisma, PostgreSQL 16 (`pg_trgm` for food search), OpenAPI at `/api/docs` |
| Web | Next.js (App Router) + shadcn/ui + Tailwind CSS |
| Shared | `@clearplate/targets` — pure TypeScript targets engine (BMR, TDEE, macros, safety floors) |
| Runtime | Docker Compose: `db`, `api`, `web` |

MongoDB is intentionally not used: every entity (users, diary, foods, recipes, weights) is relational,
and Postgres covers full-text and fuzzy search.

## Layout

```
apps/
  api/        NestJS REST API
  web/        Next.js web app
packages/
  targets/    shared targets engine
```

## Run everything in Docker

```bash
cp .env.example .env      # set JWT_SECRET at minimum
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/api (docs: http://localhost:4000/api/docs)

## Local development

```bash
pnpm install
docker compose up -d db
pnpm --filter @clearplate/api prisma:migrate
pnpm --filter @clearplate/api seed
pnpm dev:api
pnpm dev:web
```

## Status

Web v1 thin slice (see the PRD): email login, questionnaire, targets, food search and diary, recipes, weight trend.
Google and Facebook sign-in switch on when their client IDs are set in `.env`.
Barcode scanning is a paid module and is out of the v1 scope; looking a food up by its barcode number is free.
