# Clearplate

Nutrition tracking built around one clear daily equation: **Goal − Food = Left today**.
Goals: sharp thinking, steady energy, fat loss — without guesswork.

## Stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11, Drizzle ORM, PostgreSQL 16 (`pg_trgm` for food search), OpenAPI at `/api/docs` |
| Web | Next.js 16 (App Router, Turbopack) + shadcn/ui + Tailwind CSS 4 |
| Shared | `@clearplate/targets` — pure TypeScript targets engine (BMR, TDEE, macros, safety floors) |
| Runtime | Docker Compose: `db`, `api`, `web` |

MongoDB is intentionally not used: every entity (users, diary, foods, recipes, weights) is relational,
and Postgres covers full-text and fuzzy search. Drizzle was chosen over Prisma: pure TypeScript, SQL-first,
no engine binaries to download at build or run time.

## Layout

```
apps/
  api/        NestJS REST API (src/<module>, drizzle/ migrations, test/ e2e)
  web/        Next.js web app (src/app routes, src/components/ui = shadcn)
packages/
  targets/    shared targets engine + unit tests
```

## Run everything in Docker

```bash
cp .env.example .env
# set JWT_SECRET (openssl rand -base64 48); everything else has defaults
docker compose up --build
```

- Web: http://localhost:3000
- API docs: http://localhost:4000/api/docs

On start the API applies migrations and seeds the starter catalogue (idempotent).
The browser only talks to the web origin: `/api/*` is proxied to the API, so the session
cookie is first-party and OAuth callbacks land on the web app.

Behind HTTPS set `COOKIE_SECURE=true` and `WEB_URL=https://your-domain`.

### Google and Facebook sign-in

Leave the variables empty to hide the buttons. To enable, set the client id/secret in `.env` and register
these redirect URIs with the provider:

- `${WEB_URL}/api/auth/google/callback`
- `${WEB_URL}/api/auth/facebook/callback`

## Local development

```bash
pnpm install
docker compose up -d db
pnpm --filter @clearplate/targets build
pnpm --filter @clearplate/api db:migrate:dev
pnpm --filter @clearplate/api seed
pnpm dev:api        # :4000
pnpm dev:web        # :3000
```

Schema changes: edit `apps/api/src/db/schema.ts`, then `pnpm --filter @clearplate/api db:generate`.

### Importing recipes

```bash
pnpm --filter @clearplate/api import:recipes -- --source all --limit 500   # receptite.com, gotvetesmen.com, 1001recepti.com
pnpm --filter @clearplate/api import:recipes -- --explain <recipe url>     # how one recipe's macros were derived
pnpm --filter @clearplate/api import:recipes -- --refresh --offline        # re-estimate everything from the page cache, dropping recipes that no longer pass
```

The importer honours robots.txt (sites that opt out AI crawlers are skipped), fetches one page per second per host and keeps a page cache in `apps/api/.import-cache/`. Calories, protein, fat and carbs are estimated from the ingredient list against the seed catalogue; each imported recipe stores its source URL and how much of its ingredients were recognised. See `apps/api/AGENTS.md` for the rules.

## Tests

```bash
pnpm --filter @clearplate/targets test      # engine unit tests
pnpm --filter @clearplate/api test:e2e      # API e2e, needs Postgres; uses TEST_DATABASE_URL
                                            # (default postgresql://clearplate:clearplate@localhost:5432/clearplate_test)
pnpm --filter @clearplate/web lint          # typecheck + eslint
```

## Languages

English and Bulgarian, end to end:

- Every page lives under `/en/...` or `/bg/...` (both prerendered). Unprefixed URLs redirect to the
  remembered language (`cp_locale` cookie), else the browser's `Accept-Language`.
- UI strings: `apps/web/src/i18n/en.ts` and `bg.ts` (`bg` is type-checked against the English shape,
  so a missing translation fails the build). Numbers and dates use `Intl` (`en-US` / `bg-BG`).
- The user's language is saved on the account (`users.locale`) and restored at login; the EN/BG switch
  is in the header and in Settings.
- Content: foods and recipes carry Bulgarian names/texts (`name_bg`, `ingredients_bg`, `method_bg`);
  search matches both languages. The API returns structured data (e.g. the next-best-food reason) so
  clients phrase it themselves.

Adding a language: add it to `LOCALES` in `apps/web/src/i18n/config.ts`, add a dictionary, extend the
`locale` enum in the API schema.

## Status (web v1 thin slice)

- Email + password auth, optional Google / Facebook, account deletion (GDPR Art. 17)
- 5-step questionnaire with live plan preview, explicit health-data consent, 18+ gate
- Today: Goal − Food = Left, macros, next best food, weight trend, streak
- Diary: search (typo tolerant), recent, recipes, quick estimate, barcode lookup; edit, remove, undo
- Barcode lookup by camera or typed number: 5 distinct products a day for free (`FREE_SCANS_PER_DAY`),
  unlimited with the Barcode module. Both routes share one allowance, since the server cannot tell them apart.
- Recipes with a "fits what's left today" filter; Progress with smoothed weight trend

Not yet: adaptive target correction, mobile apps,
licensed food database import. The starter catalogue (134 foods, 30 recipes) uses rounded USDA-style
reference values and is marked unverified.

Clearplate is a wellness tool, not medical advice.
