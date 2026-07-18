# ElitaleRestro — Project Memory

> Accumulated decisions, completed work, and ongoing context. **Read at the start of every session.** Update at the end of significant sessions. Coding standards live in `AGENTS.md`.

---

## Project Snapshot

- **ElitaleRestro** — restaurant management app: **orders + inventory + menu + tables + billing**.
- **Users:** restaurant owners/operators (see `buyer` agent) and floor/kitchen staff (see `staff` agent).
- **Stage:** early scaffold. Prisma 7 wired up; first domain model (`User` = restaurant manager, **phone-primary**) with Zod validators + repository + service + a Vitest suite. Phone-first login UI in place (OTP backend not wired). Migration pending DB connectivity.

---

## Current Codebase State (2026-07-18)

- `src/app/` — root `layout.tsx`/`page.tsx`/`globals.css`; `login/` (phone-first login); **`admin/`** — `layout.tsx` (admin-gated), `page.tsx` (overview), `users/`, `restaurants/` (+ `new/` onboard)
- `src/proxy.ts` — Next 16 Proxy: optimistic auth gate; unauthenticated → `/login`
- `src/actions/` — `helpers.ts` (`withValidation`, `withAdminValidation`), `restaurant.actions.ts` (+ specs)
- `src/services/` — `user.service.ts`, `admin-user.service.ts` (`listUsers`), `restaurant.service.ts` (`onboardRestaurant`, `listRestaurants`) (+ specs)
- `src/repositories/` — `user.repository.ts` (CRUD + `findUsersPaginated`, `getUserAuthState`), `restaurant.repository.ts` (+ specs)
- `src/hooks/` — `use-server-action.ts`; `src/types/` — `index.ts` (`ActionResult`/`Paginated`), `admin.ts` (DTOs)
- `src/lib/` — `utils.ts` (+ `serializeForClient`), `prisma.ts`, `admin-auth.ts`, `auth-helpers.ts`, `constants.ts`, `validators/{shared,user,admin}.ts`
- `src/components/` — `login-form.tsx`, `phone-input.tsx`; `admin/` (nav, shell, tables, onboard form); `shared/` (`PageHeader`, `EmptyState`); `ui/` shadcn primitives (`button`, `input`, `label`, `separator`, `field`, `select`)
- `prisma/schema.prisma` — `UserRole` enum + **`User`** (role/suspendedAt/deletedAt) + **`Restaurant`** model
- `prisma.config.ts` — Prisma 7 config; `src/generated/prisma/` — generated client (gitignored)
- `vitest.config.ts` — node env, `@` alias, `src/**/*.spec.ts` (54 specs)
- **Not yet present:** Resend (email) integration; POS/order/inventory modules. (DB live; migrations `init` + `admin` + `add_otp_challenge` applied.)

### Installed stack
Next 16.2.10 · React 19.2.4 · TypeScript 5 · Tailwind v4 · shadcn/ui + `@base-ui/react` · `lucide-react` · ESLint 9 · React Compiler.
**Data:** Prisma 7.8.0 + `@prisma/adapter-pg` + `pg` · `dotenv`. **Auth:** `twilio` (SMS OTP) + `jose` (session JWT). **Validation:** `zod` 4.4.3 + `libphonenumber-js`. **Tests:** `vitest` 4.1.10 · `tsx`. **DB:** **Prisma Postgres** (`db.prisma.io`), migrations applied.

---

## Decisions

- **Architecture:** layered `UI → Actions → Services → Repositories → DB` (details in `AGENTS.md`).
- **Data layer:** PostgreSQL (Supabase) + **Prisma 7**, using the new `prisma-client` generator (output `src/generated/prisma`, imported via `@/generated/prisma/client`) and the **`pg` driver adapter** (required by Prisma 7's query compiler). Client singleton in `src/lib/prisma.ts`; only repositories import it. Datasource url set in `prisma.config.ts` from `DATABASE_URL`.
- **Testing:** **Vitest** is the runner (`npm test`). TDD mandatory; co-locate `*.spec.ts`. Unit-test services by mocking the repository module; unit-test repositories by mocking `@/lib/prisma` (`vi.hoisted` + `vi.mock`).
- **User model:** `User` = platform account. **Phone is the primary identifier** (unique, E.164); `email` optional/unique. Roles via `UserRole` enum (`MANAGER` default, `ADMIN`, `SUPER_ADMIN`) + `suspendedAt`/`deletedAt` soft-delete. **`Restaurant`** = onboarded entity owned by a manager (`ownedRestaurants` relation).
- **Auth (wired):** custom **phone-OTP** login. `requestOtpAction` → 6-digit code, HMAC-hashed (`AUTH_SECRET`) into an `OtpChallenge` row, SMS via **Twilio** (`lib/twilio.ts`, Programmable Messaging + `TWILLIO_FROM_NUMBER`). `verifyOtpAction` → check code → find/create user → **`jose` JWT session cookie** `restro_session` (`lib/session.ts`). `getCurrentUserId()`/`requireUserId()` read the session; proxy checks the cookie (optimistic). Chose a custom session over Auth.js (simpler, fully server-action-native). No Twilio Verify (no Verify SID).
- **Docs wiring:** `AGENTS.md` = coding standards (source of truth); `MEMORY.md` = state/decisions. `CLAUDE.md` imports both.
- **Icons:** `@tabler/icons-react` is the intended set for feature code; scaffold + shadcn blocks currently ship `lucide-react`.
- **Fonts:** body/UI = **Inter** (`--font-sans`), headings = **Outfit** (`--font-heading`, auto-applied to `h1`–`h6` in `globals.css`), mono = **Geist Mono** (`--font-mono`). Wired in `layout.tsx` + `@theme inline`. (Fixed a bug where `--font-sans` self-referenced an undefined var → serif fallback.)

---

## Completed Work

### 2026-07-18 — Agent personas created (`.github/agents`)
- **`buyer.agent.md`** — "ICP Lie Detector": 6 restaurant-owner personas (independent single-location, multi-outlet QSR chain, cloud kitchen, fine dining, cafe/bakery, bar/pub) to stress-test features, UX, pricing, and marketing in restaurant math (covers, food cost %, pour cost, shrinkage, aggregator commission).
- **`staff.agent.md`** — "Floor & Kitchen Ops": 5 daily-operator personas (server, cashier, kitchen expeditor/KDS, floor manager, stores clerk) to evaluate flows for taps, batch actions, rush-readiness, and offline resilience.
- **`dharmendra.agent.md`** — senior architect / full-stack engineer (pre-existing, retained).
- Removed the empty `va.agent.md` placeholder (replaced by the restaurant-specific `staff.agent.md`).

### 2026-07-18 — Documentation
- Populated `AGENTS.md` as the coding-standards / architecture source of truth (preserving the managed `nextjs-agent-rules` block).
- Populated this `MEMORY.md`.

### 2026-07-18 — Prisma 7 data layer set up
- Installed Prisma 7.8.0 (`prisma`, `@prisma/client`) + `@prisma/adapter-pg`, `pg`, `dotenv`.
- `npx prisma init` scaffolded `prisma/schema.prisma` (`prisma-client` generator → `src/generated/prisma`) and `prisma.config.ts` (datasource url from `DATABASE_URL`); existing `.env` preserved.
- Added `src/lib/prisma.ts` — global-cached `PrismaClient` singleton via the `PrismaPg` adapter (named export, strict TS, boundary check on `DATABASE_URL`).
- Added npm scripts: `db:generate`, `db:migrate`, `db:deploy`, `db:studio`, and `postinstall: prisma generate`. Gitignored `/src/generated`; ESLint-ignored `src/generated/**`.
- Verified: `prisma generate` ✓, `tsc --noEmit` ✓, `eslint src` ✓.
- **Blocked:** first migration not run — Supabase **direct** connection is IPv6-only and unreachable from this IPv4 network (`P1001`). See Gotchas.

### 2026-07-18 — User (manager) data layer + phone-first login UI
- **Schema:** added `User` model (id cuid, `phone` unique, `phoneVerifiedAt?`, `email?` unique, `emailVerifiedAt?`, `name?`, `isActive`, timestamps); `prisma generate` ✓.
- **Validators:** `lib/validators/shared.ts` (`phoneSchema` E.164, `emailSchema` normalised, `idSchema`, `nameSchema`) + `lib/validators/user.ts` (`registerManagerSchema`, `addEmailSchema`).
- **Repository:** `repositories/user.repository.ts` — `createUser`, `findUserById/ByPhone/ByEmail`, `updateUser`.
- **Service:** `services/user.service.ts` — `registerManager` (phone-unique), `getManagerById/ByPhone`, `addEmailToManager` (email-unique). Domain errors: `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_IN_USE`, `USER_NOT_FOUND`.
- **Tests (Vitest):** added `vitest.config.ts` + `test`/`test:watch` scripts. 29 specs across validators/repo/service. `npm test` ✓, `tsc` ✓, `eslint` ✓.
- **UI:** added shadcn `login-05` block (`npx shadcn add login-05`) and adapted `components/login-form.tsx` to **phone-first** (ElitaleRestro branding, `tel` input, client-side `phoneSchema` validation, “we’ll text a one-time code”). Removed email/social login. Submit handler has a `TODO` for the request-OTP server action.
- **Blocked:** `prisma migrate dev` still fails `P1001`; the `users` table is defined + generated but not yet created in the DB.

### 2026-07-18 — Auth proxy (Next 16 middleware → proxy)
- Added `src/proxy.ts` (`export function proxy` + `config.matcher`). Optimistic cookie check (edge-safe, no DB) for the Auth.js session cookie (`authjs.session-token` / `__Secure-authjs.session-token`).
- Behaviour: unauthenticated → redirect to `/login?callbackUrl=…`; authenticated on a public route → redirect to `/`. Public routes: `/login`. Matcher excludes `api`, `_next/*`, and static asset files.
- Until Auth.js sets the session cookie, **every non-`/login` route redirects to `/login`** (the requested default). `tsc` ✓, `eslint` ✓.

### 2026-07-18 — Login UI: fonts + phone country selector
- **Fonts:** Inter (body) + Outfit (headings, auto-applied to `h1`–`h6`) + Geist Mono. Fixed `--font-sans` wiring bug (self-referenced undefined var → serif fallback). Tab title → “ElitaleRestro”.
- **`phone-input.tsx`:** reusable phone field — shadcn `select` (Base UI) **country column** (flag + dial code) + national number `Input`, composing **E.164** via `libphonenumber-js`. Country is **auto-detected from the visitor's IP** (GeoJS `get.geojs.io`, client-side so it works in local dev), falling back to browser locale, then `IN`. Emits E.164 to the parent via an effect (so async country changes propagate). Wired into `login-form.tsx`.
- Added deps: `libphonenumber-js`, shadcn `select`. `tsc` ✓, `eslint` ✓, visually verified (IP → India 🇮🇳 +91).

### 2026-07-18 — Admin panel + users list + restaurant onboarding
- Studied `/Users/soni/work/elitale/coldbirds/sequence` and ported its layered plumbing. Plan in `.plan/admin-panel.md`.
- **Schema:** `UserRole` enum (`MANAGER`/`ADMIN`/`SUPER_ADMIN`) + `User.role/suspendedAt/deletedAt`; new **`Restaurant`** model (owner = User). `prisma generate` ✓.
- **Shared plumbing:** `types/` (`ActionResult`, `success`/`failure`, `Paginated`), `actions/helpers.ts` (`withValidation`/`withAdminValidation`, Zod-schema-inferred), `hooks/use-server-action.ts`, `lib/utils#serializeForClient`.
- **Admin gate:** `lib/admin-auth.ts` (`getAdminContextOrNull`/`requireAdminPage`, DB-backed role check) over `lib/auth-helpers.ts#getCurrentUserId` seam (fails closed in prod; `DEV_ADMIN_USER_ID` for dev preview).
- **Data/logic:** `repositories/{user (+ list/authState), restaurant}`, `services/{admin-user (listUsers), restaurant (onboardRestaurant, listRestaurants)}`, `actions/restaurant.actions.ts`. Onboard = find-or-create owner by phone + unique slug.
- **UI:** `/admin` (shell + nav + overview counts), `/admin/users` (table), `/admin/restaurants` (table + `/new` onboard form via `useServerAction` + `PhoneInput`). Shared `PageHeader`/`EmptyState`.
- **Tests:** 54 specs (repos/services/actions/admin-auth/helpers/validators). `npm test` ✓, `tsc` ✓, `eslint` ✓.
- **Not live yet:** needs the two blockers resolved. No new deps; icons = lucide (avoid per-feature mixing).

### 2026-07-18 — DB live + admin user seeded
- `.env` `DATABASE_URL` now points at **Prisma Postgres** (`db.prisma.io`, `sslmode=require`) — reachable; migrations `init` + `admin` applied. The Supabase IPv6 blocker no longer applies.
- Added `prisma/seed.ts` (idempotent upsert) + `db:seed` script; installed `tsx` to run TS scripts.
- Seeded **Dharmendra Soni** (`+917597365803`, `soni@elitale.com`) as **`ADMIN`** — id `cmrq5aupg0000u96iwmkj0lyr`. `tsc` ✓, `eslint` ✓.

### 2026-07-18 — Phone-OTP auth wired (Twilio + jose)
- **Schema:** `OtpChallenge` model (phone, hashed code, expiry, attempts, consumedAt) + migration `add_otp_challenge`.
- **lib:** `otp.ts` (generate + HMAC-hash), `twilio.ts` (`sendSms`), `session.ts` (`jose` JWT `restro_session` cookie: create/get/destroy). `auth-helpers.ts` now session-backed (`getCurrentUserId`, `requireUserId`).
- **repo/service:** `otp.repository.ts`; `auth.service.ts` (`requestOtp` — 30s resend limit; `verifyOtp` — 5-attempt cap, 5-min TTL, find-or-create user).
- **actions:** `auth.actions.ts` — `requestOtpAction`, `verifyOtpAction` (sets session), `logoutAction`.
- **UI:** two-step `login-form.tsx` (phone → 6-digit code via `useServerAction`), `/dashboard` (protected, `requireUserId` + sign-out). Proxy checks `restro_session`; signed-in users land on `/dashboard`.
- **Tests:** 72 specs. `npm test` ✓, `tsc` ✓, `eslint` ✓. Live: `/login` 200, `/dashboard` 307 (redirects when signed out).
- `DEV_ADMIN_USER_ID` is set to the admin id → `getCurrentUserId()` returns the admin in dev even without a session.

---

## Pending / Next Steps

- **Add-email-later flow:** UI + action calling `addEmailToManager` (Resend for verification/notifications).
- First operational module (**Menu** or **Order/POS**), bottom-up per `AGENTS.md`.

---

## Notes / Gotchas

- **`AGENT.md` vs `AGENTS.md`:** `.github/copilot-instructions.md` says "AGENT.md", but the live file imported by `CLAUDE.md` is **`AGENTS.md`**. Treat `AGENTS.md` as the source of truth.
- **copilot-instructions template drift:** `.github/copilot-instructions.md` was adapted from the coldBirds project (its title still reads "coldBirds"). Some rules there are coldBirds-specific and do **not** apply here (e.g., Cloudflare/Resend SDKs, cold-email domain). `AGENTS.md` reflects the restaurant project's actual conventions.
- **Next.js 16:** read `node_modules/next/dist/docs/` before writing Next code — APIs differ from training data. Notably **`middleware.ts` is renamed to `proxy.ts`** (`export function proxy(request: NextRequest)`, optional `config.matcher`); the old `middleware` convention is deprecated.
- **Never hard-reset the database** once one exists — it wipes NextAuth session rows and causes redirect/reload loops in dev. Prefer additive migrations; ask before any destructive change.
- **Supabase direct connection is IPv6-only.** `db.<ref>.supabase.co:5432` has no IPv4 `A` record → `P1001` on IPv4-only networks. Use the **Supavisor pooler** instead (username `postgres.<project-ref>`, host `aws-0-<region>.pooler.supabase.com`): session pooler `:5432` for migrations, transaction pooler `:6543?pgbouncer=true` for the serverless app. Copy the exact string from Supabase → Project Settings → Database → Connection string (region appears to be `ap-south-1`). Also confirm the project isn't paused (free tier auto-pauses).
- **Prisma 7 specifics:** client is generated (not shipped in `@prisma/client`) to `src/generated/prisma` via the `prisma-client` generator; import from `@/generated/prisma/client` (model type is `User`, aliased from `Prisma.UserModel`). The query compiler **requires a driver adapter** (`@prisma/adapter-pg`) — `new PrismaClient()` won't connect without one. `prisma.config.ts` loads env via `dotenv` and holds the datasource url.
- **Notification/auth env vars (exact names):** Resend → `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL` (still a coldBirds/tax `from` address — update before sending). Twilio → **`TWILLIO_A_SID`**, `TWILLIO_AUTH_SECRET`, `TWILLIO_PRIMARY_TOKEN`, `TWILLIO_FROM_NUMBER` (note the misspelled `TWILLIO` prefix — use verbatim or rename the vars). Also `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `CRON_SECRET`.
- **Twilio SMS:** sending from the US `TWILLIO_FROM_NUMBER` to Indian (`+91`) numbers is **authorized** — no DLT caveat. **Real OTP is sent in every environment (dev + prod)**: `requestOtp` always calls Twilio with no `NODE_ENV` gate; only the Vitest suite mocks `sendSms` (automated tests must never fire real SMS). `AUTH_SECRET` is reused to HMAC OTP codes and sign the `restro_session` JWT.
