# Admin panel + users + restaurant onboarding

> Learned from `/Users/soni/work/elitale/coldbirds/sequence`. Follows the layered architecture (UI → Actions → Services → Repositories → DB) and coldbirds' shared plumbing.

## Locked decisions
- **Roles:** `UserRole` enum on `User` — `MANAGER` (default, regular user), `ADMIN`, `SUPER_ADMIN`. Admin = ADMIN|SUPER_ADMIN.
- **Restaurant** model: onboarded entity, owned by a `User` (manager). Soft-delete via `deletedAt`.
- **Admin gate (defense in depth):** edge `proxy.ts` (already redirects unauthenticated → /login) + `requireAdminPage()` in the `/admin` RSC layout (DB-backed role check).
- **Shared plumbing (ported from coldbirds):** `types` (`ActionResult`, `success`/`failure`, `Paginated`), `actions/helpers.ts` (`withValidation`, `withAdminValidation`), `hooks/use-server-action.ts`, `lib/utils#serializeForClient`, `lib/admin-auth.ts`.
- **Auth seam:** `lib/auth-helpers.ts#getCurrentUserId()` — TODO to wire Auth.js. Fails closed in prod; `DEV_ADMIN_USER_ID` env allows dev preview.
- **Icons:** lucide (app currently standardizes on lucide; avoid per-feature mixing). No shadcn sidebar/table/badge installs — lightweight custom nav + plain tables.
- **No toast lib** — `useServerAction` reports errors via `onError` callback (inline), not sonner.

## Scope (this pass)
- Admin shell + nav + `/admin` overview (counts).
- `/admin/users` — list users (search + pagination), read-only.
- `/admin/restaurants` — list + `/admin/restaurants/new` onboard form (creates restaurant + owner-by-phone).

## Deliberately skipped (YAGNI for the ask)
- Audit log, webhooks, suspend/restore/delete users, admin notes.
- Onboarding wizard/metadata/routing flags (coldbirds self-onboarding differs from admin-onboards-restaurant).
- Auth.js wiring + Twilio OTP (separate feature).

## Blockers to go live
1. DB migration blocked (Supabase direct URL is IPv6-only) → switch `DATABASE_URL` to the session pooler, then `npm run db:migrate`.
2. Auth.js not wired → replace `getCurrentUserId()` seam + seed an `ADMIN` user.

## Verification
- `npm test` (vitest, mocked), `tsc --noEmit`, `eslint src`. Browser run needs the two blockers resolved.
