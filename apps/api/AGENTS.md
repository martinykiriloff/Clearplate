# @clearplate/api

NestJS 11 + Drizzle ORM + PostgreSQL 16. Read the root `CLAUDE.md` first.

## Map

```
src/
  main.ts            bootstrap (rawBody on for Stripe signatures; RUN_MIGRATIONS=true applies migrations first)
  setup.ts           configureApp(): global prefix /api, helmet, cookies, CORS to WEB_URL, ValidationPipe, Swagger
  app.module.ts      ConfigModule (validateEnv) + Throttler (300/min, off in tests) + feature modules
  config/env.ts      fail-fast env validation; add mandatory vars here
  db/schema.ts       the single Drizzle schema (enums, tables, indexes)
  db/migrate.ts      runs drizzle/ SQL migrations
  db/seed.ts         idempotent starter catalogue (seed-data/*)
  common/dates.ts    ISO date helpers: parseDateParam, clientToday, addDays, ageOn
  auth/              JWT in httpOnly cookie `cp_session`, global JwtAuthGuard, @Public(), @CurrentUser(), social strategies
  billing/           EntitlementsService (Stripe + ENTITLEMENT_GRANTS), @RequiresModule(), Stripe webhooks
  profile/           questionnaire -> targets (via @clearplate/targets)
  foods/ recipes/ diary/ weights/   feature modules
  health/            /api/health
drizzle/             generated SQL migrations + meta snapshots (committed)
test/                e2e suites (*.e2e-spec.ts), app.ts harness, fixtures.ts
src/**/*.spec.ts     unit tests (jest, no database)
```

## Coding standards

These are the bar for every change. "Matches the file next to it" is the tie-breaker, not an excuse.

**TypeScript**
- `strict` on, no `any`, no non-null `!` except right after a check that makes it obvious, no `as` casts to silence the compiler. If a type is wrong, fix the type.
- Model state with unions and discriminated objects, not booleans or optional soup: `{ kind: 'protein_gap'; gapG } | { kind: 'fits_budget'; leftKcal }`, not `{ isProteinGap?: boolean; gapG?: number }`.
- Derive types from the source of truth: table row types from the Drizzle schema (`typeof foods.$inferSelect`), enum unions from `pgEnum` values, request shapes from DTO classes. Never retype by hand what the schema already knows.
- `readonly` on injected dependencies and on anything that is not meant to change. Prefer `const` and immutable updates; mutate only local variables inside a function.
- Exported functions have explicit return types. Internal helpers may infer.
- `import type` for type-only imports. Imports ordered: node, external, `@clearplate/*`, relative. No unused imports or variables (tsc catches the latter; keep the former clean anyway).

**Functions and modules**
- One function does one thing and fits on a screen. If you need a comment to separate the halves, split it.
- Pure logic (maths, date arithmetic, parsing) goes in a plain function with no Nest or DB dependency so it can be unit tested directly. Services orchestrate; they do not compute.
- Services are the only place that touches `db`. Controllers validate input, call one service method, and return. No business logic in controllers or guards beyond their single concern.
- No module-level mutable state. No singletons outside Nest DI.
- Parameters: at most three positional, otherwise an options object with named fields. `userId` is always the first parameter of a per-user service method.

**Naming**
- Files: kebab-case (`scan-quota.ts`, `open-food-facts.ts`). Classes `PascalCase`, functions and variables `camelCase`, constants that are true constants `UPPER_SNAKE` (`FREE_SCANS_PER_DAY`).
- Names carry units and meaning: `weightKg`, `proteinG`, `sodiumMg`, `maxAgeMs`, `effectiveFrom`. A bare `value`, `data`, `item`, `tmp` is a review comment.
- Booleans read as predicates: `isEstimate`, `hasSession`, `onboarded`. Functions are verbs: `parseDateParam`, `clientToday`, `record`.
- DTOs end in `Dto` for bodies and `Query` for query strings. DB symbols are the table name in camelCase (`diaryEntries`, `barcodeScans`).

**Errors and validation**
- Validate at the edge with class-validator; trust the DTO inside. Do not re-validate in the service what the pipe already guarantees.
- Throw Nest exceptions with a short English `message`. Use `BadRequest` for input, `NotFound` for anything the user cannot see (including other users' rows), `Conflict` for uniqueness, `402` with a stable `code` for paywalls. Never `500` on purpose; an unexpected state is a bug, let it throw.
- Never swallow errors. `catch` only to translate (e.g. a unique-violation into a 409) or to clean up, then rethrow or throw a typed exception. No empty catch, no `catch (e) { console.log(e) }`.
- Fail fast on configuration: a missing mandatory env var stops boot in `config/env.ts`, it does not produce a half-working app.

**Async and data access**
- `async/await` only; no `.then` chains, no floating promises (`void` an intentionally unawaited call and say why).
- Independent queries run in `Promise.all`. Dependent writes that must succeed together run in `db.transaction`.
- Prefer one well-shaped query over N round trips. Fetch only the columns you return (`select({ ... })`), never `select()` whole rows into a response.
- Every per-user read and write filters by `userId` in the `where`. Treat a missing filter as a security bug, not a style issue.
- Idempotent writes where the domain allows it: `onConflictDoNothing` / `onConflictDoUpdate` with an explicit `target`.
- Dates and numbers cross the API as strings (`YYYY-MM-DD`) and plain numbers. No `Date` objects in responses, no timezone math outside `common/dates.ts`.

**Security and privacy**
- Never log emails, tokens, password hashes or profile (health) fields. Log ids.
- Secrets come from env only. No defaults for secrets, no secrets in tests other than clearly fake ones in `test/env-setup.ts`.
- Anything the client could forge (dates, ids, locale) is validated server-side; the client's claim is a hint, not a fact.
- Raw request bodies are only used for Stripe signature checks. Everything else goes through DTOs.

**Comments and docs**
- A doc comment on every exported class, function and non-obvious field, stating the contract (units, defaults, what `null` means). See `ScanQuota` and `common/dates.ts`.
- Inline comments explain a decision or a trap (why `trust proxy` is scoped, why a 404 instead of 403), never restate the code.
- Keep Swagger accurate: `@ApiTags` on controllers, `@ApiProperty` where the type alone does not document the field, `@ApiExcludeEndpoint` on webhooks.
- No TODO without an issue reference. No commented-out code.

**Tests**
- Every behaviour change ships with a test in the same commit: e2e for anything over HTTP, a `*.spec.ts` for guards and pure helpers.
- Tests describe behaviour in the `it` name, in plain language: `'rejects dates more than a day from today'`, not `'test clientToday 2'`.
- Arrange with real requests (`signedInAgent`), not by seeding rows directly, unless the test is about the seed.
- Assert on status code and the fields that matter (`toMatchObject`), not on full response snapshots.
- No sleeps, no order dependence between tests, no shared mutable fixtures. Each test creates its own user.

**Definition of done**
`pnpm --filter @clearplate/api lint` and `test:e2e` (and `test` if you added specs) pass locally; new env vars are in `.env.example` and `docker-compose.yml`; schema changes have a committed migration; the OpenAPI doc at `/api/docs` still describes the truth.

## Module conventions

- Small features are **one file**: DTOs, service, controller and `@Module` together (`weights/weights.ts`, `foods/foods.ts`, `diary/diary.ts`, `recipes/recipes.ts`). Split into `*.controller.ts` / `*.service.ts` / `*.module.ts` only when the file gets unwieldy (`auth/`, `profile/`, `billing/`).
- Inject the database with `@InjectDb() private readonly db: Database` from `db/db.module.ts`. Query with the Drizzle query builder, not raw SQL, except for `pg_trgm` search expressions.
- Every route is authenticated by default. `@Public()` opts out (register, login, health, OAuth callbacks, Stripe webhook). Read the user with `@CurrentUser() user: AuthUser`.
- Paid features: decorate the handler with `@RequiresModule('barcode' | 'insights' | 'recipes' | 'data')`. Failures are `402` with `{ code: 'module_required' | 'scan_limit_reached', module, ... }` so the web can show the right upgrade screen. Keep codes stable.
- DTOs are `class-validator` classes; the global pipe uses `whitelist` + `forbidNonWhitelisted` + `transform`, so unknown fields are a 400. Dates use `@IsDateString({ strict: true })`.
- Per-user data is always scoped by `userId` in the query. Another user's row is a `404`, never a `403` (no existence leak). Cross-user uniqueness (e.g. barcodes) is per user.
- Errors: throw Nest `HttpException`s with a plain English `message`; the web only displays it in English and uses its own translation otherwise. Put structured data in the body for anything the client must branch on.
- Add `@ApiTags('<module>')` on controllers; Swagger is served at `/api/docs`.

## Database

- Edit `src/db/schema.ts`, then `pnpm --filter @clearplate/api db:generate` to produce `drizzle/<n>_<name>.sql` and its snapshot. Commit both. Never hand-edit a committed migration; add a new one.
- Every table gets `created_at`/`updated_at` via the shared `timestamps` spread unless it is append-only.
- Foreign keys to `users` use `onDelete: 'cascade'` so account deletion is complete.
- New enums live in the schema (`pgEnum`); their TS unions in `@clearplate/targets` or `web/src/lib/api.ts` must be kept in sync.
- Content tables (`foods`, `recipes`) carry Bulgarian text columns (`name_bg`, `ingredients_bg`, `method_bg`); search matches both.
- Seeds must stay idempotent (`onConflictDoNothing` / upsert); `docker-entrypoint.sh` runs migrate + seed on every container start.

## Tests

```bash
docker compose up -d db
pnpm --filter @clearplate/api test:e2e        # jest --config test/jest-e2e.json --runInBand
```

- `test/global-setup.ts` drops and recreates the schema on `TEST_DATABASE_URL` (default `clearplate_test`), migrates and seeds. Suites may rely on seeded foods/recipes.
- `test/app.ts`: `createApp()` builds the real `AppModule` with the Open Food Facts provider replaced by `fakeFoodProvider` (barcode `3800123456789`). `signedInAgent(app)` registers a fresh user and returns a supertest agent carrying the cookie.
- `test/env-setup.ts` sets `NODE_ENV=test`, grant fixtures (`paid@example.com:all`, `scanner@example.com:barcode`) and dummy Stripe keys. Add fixtures there, not inline.
- Each feature gets an `*.e2e-spec.ts`. Cover: unauthenticated 401, happy path, validation 400, cross-user isolation, and any 402 paywall.
- Unit tests for guards and small services live next to the code as `src/**/*.spec.ts` and run with `pnpm --filter @clearplate/api test` (no database). Pure nutrition maths is tested in `@clearplate/targets`.
- `pnpm --filter @clearplate/api lint` is `tsc --noEmit`; it must pass with zero errors.

## Env

Mandatory: `DATABASE_URL`, `JWT_SECRET` (≥32 random chars in production). Defaults: `API_PORT=4000`, `JWT_EXPIRES_IN=7d`, `WEB_URL=http://localhost:3000`. Optional: Google/Facebook OAuth, `ENTITLEMENT_GRANTS` (`email:module[,module];...`), Stripe keys and price ids, `COOKIE_SECURE`. Declare new vars in `.env.example` and `docker-compose.yml` as well.
