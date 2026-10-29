# Clearplate

Nutrition tracking around one equation: **Goal − Food = Left today**. Wellness tool, not medical advice.
`README.md` has the full run/test instructions; this file is the working contract for agents.

## Layout

pnpm workspace (Node 22, `pnpm@10`). Three packages, each with its own `AGENTS.md`:

| Package | Path | What |
| --- | --- | --- |
| `@clearplate/api` | `apps/api` | NestJS 11 REST API, Drizzle ORM, PostgreSQL 16. See `apps/api/AGENTS.md`. |
| `@clearplate/web` | `apps/web` | Next.js 16 App Router, React 19, shadcn/ui, Tailwind 4. See `apps/web/AGENTS.md`. |
| `@clearplate/targets` | `packages/targets` | Pure TS targets engine (BMR, TDEE, macros, trend, floors). No deps, Vitest. |

Rules of the layout:

- Nutrition maths lives in `packages/targets`, never duplicated in API or web. Build it (`pnpm --filter @clearplate/targets build`) before the API or web can resolve it.
- No MongoDB, no Prisma. Everything relational in Postgres via Drizzle; search uses `pg_trgm`.
- The browser only talks to the web origin. `/api/*` is rewritten to the NestJS API so the `cp_session` cookie is first-party.

## Commands

```bash
pnpm install
docker compose up -d db                     # Postgres on :5432
pnpm --filter @clearplate/targets build
pnpm --filter @clearplate/api db:migrate:dev && pnpm --filter @clearplate/api seed
pnpm dev:api                                # :4000, docs at /api/docs
pnpm dev:web                                # :3000
```

Verification, in the order CI runs it (`.github/workflows/ci.yml`):

```bash
pnpm --filter @clearplate/targets test       # Vitest unit tests
pnpm --filter @clearplate/api lint           # tsc --noEmit
pnpm --filter @clearplate/api test:e2e       # Jest + supertest, needs Postgres (TEST_DATABASE_URL)
pnpm --filter @clearplate/web lint           # tsc --noEmit && eslint
pnpm --filter @clearplate/web build
```

Run the checks for every package you touched before calling work done. `docker compose up --build` is the full-stack smoke test.

## Conventions that apply everywhere

- TypeScript `strict` everywhere. No `any`; use narrow types and discriminated unions (see `NextBestFood.reason`).
- Formatting: 2-space indent, LF, final newline (`.editorconfig`). No Prettier config; match the surrounding file. Long lines are accepted. API uses single quotes, web uses double quotes.
- Comments explain *why* (a security decision, a browser quirk, a GDPR article). Do not narrate what the code does.
- Dates are `YYYY-MM-DD` strings. "Today" is the client's local date, sent by the client; the server only validates it (±1 day) and falls back to UTC.
- Both languages, always. Any user-facing string gets an `en` and a `bg` entry; any content entity gets a `*_bg` column. A missing translation is a build error on web.
- Config comes from `.env` at the repo root (API also reads `../../.env`). New env vars go in `.env.example`, `docker-compose.yml` and, when mandatory, `apps/api/src/config/env.ts`.
- Privacy: profiles are health data (GDPR Art. 9) and need explicit consent; account deletion must cascade. Do not log emails, tokens or health fields.
- Security findings from reviews are fixed, not deferred: whitelist validation, 402 with a stable `code` for paywalls, `httpOnly` cookies, rate limiting are already in place; keep them.

## Git

- Branches come from Linear: `cle-<n>-<slug>`. Reference the ticket in the commit subject, e.g. `feat: free camera barcode scanning (CLE-1)`.
- Conventional commits with an optional scope: `feat(api):`, `fix(web):`, `feat(targets):`, `build:`, `chore:`.
- PRs target `main`. Do not commit `.env`, `.pnpm-store/`, `*.tsbuildinfo` or `apps/web/AGENTS.md` churn from `next dev` beyond the committed block.

## Product status

Shipped: email/password + optional Google/Facebook auth, 5-step questionnaire with consent and 18+ gate, Today, Diary (search, recent, recipes, estimate, barcode), camera scanning (5 distinct products/day free, unlimited with the Barcode module), recipes, weight trend, Stripe-backed paid modules (`barcode`, `insights`, `recipes`, `data`, `all`), EN/BG.

Not yet: adaptive target correction, mobile apps, licensed food database import. The seed catalogue (134 foods, 30 recipes) is marked unverified.
