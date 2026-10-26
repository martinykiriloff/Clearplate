<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# @clearplate/web

Next.js 16 App Router (Turbopack, `cacheComponents`), React 19, shadcn/ui (new-york, slate), Tailwind CSS 4, SWR. Read the root `CLAUDE.md` first.

## Map

```
src/
  proxy.ts                 locale redirect (/ -> /en or /bg) + optimistic auth redirects by cp_session cookie
  app/globals.css          Tailwind 4 + design tokens (dark theme, Onest + IBM Plex Mono)
  app/[lang]/layout.tsx    validates locale, I18nProvider, Toaster; both locales prerendered
  app/[lang]/page.tsx      landing
  app/[lang]/login|register|onboarding
  app/[lang]/(app)/        signed-in area inside AppShell: today, diary, recipes, progress, settings, upgrade
  components/ui/           shadcn primitives (generated; keep edits minimal)
  components/app/          product components (budget-card, add-food, barcode-scanner, nutrition-panel, ...)
  components/auth/         auth form
  i18n/config.ts           LOCALES, cookie, Accept-Language negotiation, splitLocale
  i18n/en.ts bg.ts dict.ts provider.tsx   dictionaries and useI18n()
  lib/api.ts               fetch wrapper (same-origin /api), ApiError, response types mirroring the API
  lib/session.tsx          useUser(), useRequireUser(), hardNavigate()
  lib/billing.ts           useBilling() -> has(module)
```

## Coding standards

The bar for every change. Match the surrounding file for anything not listed here.

**TypeScript and React**
- `strict` on, no `any`, no `as` casts to appease the compiler, no non-null `!` outside an obvious guard. Narrow with type guards and discriminated unions (`reason.kind === "protein_gap"`).
- Types that describe API data live in `lib/api.ts` and nowhere else. Components import them; they do not redeclare them. If the API changes a shape, change it here in the same PR.
- Props are typed inline or as `interface XProps`; never `React.FC`. Destructure props in the signature. Give every component a named export that matches its file name in PascalCase (`budget-card.tsx` → `BudgetCard`).
- Server components by default. Add `"use client"` only to the leaf that needs state, effects, browser APIs or SWR, and keep that leaf small. A page file is never a client component.
- No `useEffect` for derived state; compute it during render or `useMemo` it. Effects are for synchronising with the outside world (router, camera, timers) and must clean up.
- Hooks follow the rules strictly (ESLint enforces them). Custom hooks start with `use` and live in `lib/` or next to the single component that uses them.
- `import type` for type-only imports. Imports ordered: react/next, external, `@/` aliases, relative. Always use the `@/` alias for anything outside the current folder.

**Components**
- Small, single-purpose components. A file over ~200 lines or a component with more than one responsibility (fetching + layout + form) gets split.
- Compose from `components/ui/*` (shadcn) first. Do not fork a primitive for a one-off; pass `className` with `cn()`.
- No inline style objects. Tailwind utility classes only, using the token classes from `globals.css` (`bg-card`, `text-muted-foreground`), never raw colours.
- Conditional classes go through `cn()`, not template strings.
- Lists render with a stable `key` from the data (`entry.id`), never the index, unless the list is static.
- Keep JSX readable: extract a sub-component before nesting ternaries; early-return loading and error states.

**Data fetching and state**
- SWR for every read, with the API path as the key and `fetcher` from `lib/api.ts`. Writes use `api()` then `mutate()` the affected keys (optimistic updates where the UI benefits, e.g. diary edits with undo).
- No fetch in `useEffect`, no global stores. Server state lives in SWR, UI state in component `useState`, cross-page state in the URL.
- Handle the four states explicitly: loading (`Skeleton`), empty, error (`errorText`), data. Never render `undefined` into the UI.
- A `401` is only ever handled by `useUser`/`useRequireUser`. Components treat every other error as retryable and show `t.common.tryAgain`.
- Forms: controlled inputs, disable the submit button while pending (`t.common.adding`), surface API validation messages via `errorText`.

**i18n (non-negotiable)**
- No string literals that a user can read, including `aria-label`, `placeholder`, `title`, `alt` and toast text. Every one is a key in `en.ts` and `bg.ts`.
- Format all numbers and dates with `n`, `n1`, `longDate`, `shortDate`. Never concatenate units by hand; use `t.common.kcal` / `t.common.g`.
- Links use `href()` from `useI18n()`. Never hard-code a locale in a path.
- Bulgarian text from the API goes through `pick()`.

**Accessibility**
- Every input has a `<Label htmlFor>`; every icon-only button has an `aria-label`; every image an `alt`.
- Use semantic elements (`button`, `nav`, `main`, `form`) before adding roles. A clickable `div` is a bug.
- Keyboard works everywhere: dialogs trap focus and close on Escape (Radix does this; do not fight it), lists are tabbable, focus moves to the first field after an action.
- Colour never carries meaning alone (progress over/under is also text).
- Numeric inputs set `inputMode` (`decimal` for grams/weight) and `autoComplete` where relevant.

**Performance**
- Keep the client bundle lean: heavy libraries (`@zxing/browser`) are imported inside the component that uses them and loaded with `next/dynamic` where possible.
- No layout shift: reserve space with `Skeleton`, give images dimensions.
- Memoise only with a measured reason. Default to plain code.
- Prerendering must keep working for both locales: nothing in a server component may read request-scoped data without opting out deliberately.

**Security**
- Never store tokens or health data in `localStorage`; the session is the `httpOnly` cookie and nothing else.
- Never build HTML from strings (`dangerouslySetInnerHTML` is forbidden).
- Leaving an account (logout, delete) uses `hardNavigate()` so no cached data survives for the next person on the device.
- Do not add `NEXT_PUBLIC_*` vars with secrets; anything public is public.

**Comments and naming**
- Files kebab-case, components PascalCase, hooks `useX`, handlers `onX` as props and `handleX` inside components.
- Names carry units: `weightKg`, `leftKcal`, `maxAgeMs`.
- Comments explain decisions and traps (see `session.tsx` on 401 vs other errors), never what the JSX obviously does. No commented-out code, no TODO without an issue.

**Definition of done**
`pnpm --filter @clearplate/web lint` and `build` pass; both dictionaries updated; the change was tried in the browser on a phone-width viewport in both `/en` and `/bg`; new app routes are in `APP_PATHS` in `proxy.ts`; API types in `lib/api.ts` match the API.

## Page pattern

- `page.tsx` is a server component: it exports `generateMetadata` reading `dictFor(lang).meta.<page>` and renders a `<Name>View` client component from the sibling `<name>-view.tsx`. Keep data fetching in the view (SWR), not in the page.
- Signed-in views start with `useRequireUser()`; it redirects to `/login` or `/onboarding`. Pass `{ allowNotOnboarded: true }` only for onboarding itself.
- Build links with `href("/today")` from `useI18n()` so the locale prefix is kept. Never hard-code `/en/...`.
- Leaving the account (logout, delete) uses `hardNavigate()` so no SWR cache survives.
- New app routes must be added to `APP_PATHS` in `proxy.ts` to get the auth redirect.

## Data and API

- All requests go through `api<T>()` in `lib/api.ts` (same origin, cookie travels automatically; `/api/*` is rewritten to NestJS in `next.config.ts`). SWR keys are the API path, e.g. `useSWR<Today>("/today?date=...", fetcher)`.
- Response types live in `lib/api.ts` and must mirror the API. When the API changes a shape, update the type here in the same PR.
- Send the user's local date (`YYYY-MM-DD`) as `date`/`today`; the server rejects dates more than one day from its own.
- Error display goes through `errorText(err, byStatus)` from `useI18n()`. Branch on `ApiError.status` and the body `code` (`module_required`, `scan_limit_reached`) to show the upgrade screen; `useBilling().has("barcode")` tells you if a module is unlocked.
- A `401` from `/auth/me` means signed out. Any other error is a retryable failure, never a redirect.

## i18n

- Every string goes in `i18n/en.ts` and `i18n/bg.ts`; `bg` is typed as `Dict` so a missing key fails `tsc`. Group keys by screen (`today`, `diary`, `errors`, ...).
- Numbers and dates via `n`, `n1`, `longDate`, `shortDate` from `useI18n()`, never `toFixed` or manual formatting.
- Bilingual content from the API: `pick(name, nameBg)`.
- Adding a locale: extend `LOCALES` in `i18n/config.ts`, add a dictionary, and extend the API `locale` enum.

## UI

- Compose from `components/ui/*` (shadcn) with `cn()` from `lib/utils.ts`; icons from `lucide-react`; toasts via `sonner`.
- Dark theme only (`colorScheme: "dark"`). Use the token classes from `globals.css`, not raw hex.
- Mobile first. Pages are used one-handed on a phone; keep primary actions reachable and inputs `inputMode`-correct.
- Camera: the barcode scanner uses `@zxing/browser`; the `Permissions-Policy` header allows `camera=(self)`. Stop the stream on unmount.
- Accessibility: labelled inputs, a skip link exists in the shell, focus management in dialogs.

## Checks

```bash
pnpm --filter @clearplate/web lint     # tsc --noEmit && eslint (flat config, next/core-web-vitals + typescript)
pnpm --filter @clearplate/web build    # must pass; both locales prerender
```

There are no unit tests in this package yet; behaviour is covered by API e2e tests and manual checks in the browser. `next dev` rewrites the block at the top of this file; commit it as is.
