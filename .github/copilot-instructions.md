# Copilot Instructions — coldBirds

> Auto-loaded into every GitHub Copilot chat for this repository.

## Project Identity

- **Name:** ElitaleRestro
- **Purpose:** Restaurant Management app
- **Stack:** Next.js 16 (App Router, RSC) · TypeScript 5.9+ · React 19 · Prisma 7 · PostgreSQL · Tailwind v4 · shadcn/ui

## Before Any Work

1. Read `AGENT.md` (root of repo) — it is the **single source of truth** for all coding standards, architecture, and conventions. Read it whenever you need to implement, review, or modify code, and follow its guidelines strictly.
2. Read `MEMORY.md` (root of repo) — it contains accumulated project decisions, completed work, and ongoing context from past sessions. Read it at the start of every session to understand current project state.
3. Follow the layered architecture strictly: **UI → Actions → Services → Repositories → DB**

## Key Rules (quick reference)

- No `any`. No `enum`. No `default export`. No Lucide icons in feature code (use Tabler).
- All external HTTP calls go through `lib/http.ts` (Axios) or official SDKs (Cloudflare, Resend).
- Validation via Zod schemas in `lib/validators/[domain].ts`, composed from `shared.ts`.
- Server Actions use `withValidation()` from `actions/helpers.ts` and return `ActionResult<T>`.
- Use shared components from `@/components/shared` (PageHeader, EmptyState, ConfirmDeleteDialog, etc.).
- Use `useServerAction` hook for client-side action calls.
- Use `serializeForClient()` in server pages before passing data to client components.
- Implement bottom-up: Schema → Repository → Service → Action → UI.
- **TDD is mandatory.** Write tests FIRST (`[name].spec.ts`), then implement to make them pass.
- Every new service, repository, action, hook, and utility MUST have a co-located `.spec.ts` test file.
- All code must be strict TypeScript (no `any`), ESLinted, and follow SOLID principles.
- Run `npm test` before marking any task complete. Zero failures required.

## Session Workflow

- **Test-first development:** For every new feature, write `.spec.ts` test files defining expected behavior BEFORE writing implementation code. Follow Red → Green → Refactor.
- At the end of significant work sessions, update `MEMORY.md` with decisions made, features completed, and any pending context.
