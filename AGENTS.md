<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ElitaleRestro — Agent Guide & Coding Standards

> **Single source of truth** for architecture, conventions, and coding standards. Read this before implementing, reviewing, or modifying code.
> Also read `MEMORY.md` for current project state, decisions, and completed work.
> Follow the layered architecture strictly: **UI → Actions → Services → Repositories → DB**.

---

## 1. Project Identity

- **Name:** ElitaleRestro
- **Purpose:** Restaurant management platform — restaurant owners/operators run their business: **orders, inventory, menu, tables, and billing**.
- **Users:**
  - **Owners / operators** — see the `buyer` agent in `.github/agents` (6 owner personas).
  - **Floor & kitchen staff** — see the `staff` agent (server, cashier, kitchen expo, floor manager, stores clerk).
  - Architecture/engineering help — see the `dharmendra` agent.
- **Stage:** early scaffold. Only base Next.js app + shadcn scaffolding exists today. See `MEMORY.md` for exactly what is wired up.

---

## 2. Tech Stack

**Installed now** (always verify against `package.json` before assuming):

- Next.js 16 (App Router, React Server Components, React Compiler enabled)
- React 19
- TypeScript 5 (strict)
- Tailwind CSS v4
- shadcn/ui + `@base-ui/react`
- `lucide-react` (scaffold default)
- ESLint 9 (`eslint-config-next`)
- **Prisma 7** — PostgreSQL data layer via the `prisma-client` generator (output `src/generated/prisma`) + the **`pg` driver adapter** (`@prisma/adapter-pg`); client singleton in `src/lib/prisma.ts`

**Intended — add when the first feature needs it** (not yet installed):

- A **test runner** (Vitest or Jest) — required for the mandated `.spec.ts` tests
- **Zod** — schema validation
- `@tabler/icons-react` — preferred icon set for feature code (see §5)

> **Next.js 16 caveat:** this is not the Next.js in your training data. Read `node_modules/next/dist/docs/` before writing Next code. Heed deprecation notices.

---

## 3. Architecture — Layered

Dependencies point **downward only**. A layer never imports from the layer above it.

```
UI (RSC pages + client components)
        ↓ calls
Server Actions        ← validation boundary (Zod), returns ActionResult<T>
        ↓ calls
Services              ← business logic, orchestration, domain rules
        ↓ calls
Repositories          ← data access, Prisma queries only here
        ↓
Database (PostgreSQL via Prisma)
```

- **RSC by default.** Add `"use client"` only when a component needs interactivity, state, or browser APIs.
- **Business logic lives in Services**, never in UI or Actions. Actions validate + delegate. Repositories do data access only.
- **Prisma is only touched inside repositories.** Services/actions/UI never import the Prisma client directly.
- **Implement bottom-up:** Schema → Repository → Service → Action → UI.

---

## 4. Directory Structure (target as the app grows)

```
src/
  app/                      # routes (RSC), layouts, pages
  actions/                  # server actions + helpers.ts (withValidation, ActionResult)
  services/                 # business logic (co-located *.spec.ts)
  repositories/             # data access via Prisma (co-located *.spec.ts)
  lib/
    prisma.ts               # PrismaClient singleton (pg adapter); repositories import this
    validators/             # Zod schemas per domain + shared.ts
    http.ts                 # single Axios wrapper for outbound HTTP (payment/aggregator APIs)
    utils.ts                # cn() + small pure helpers
  generated/prisma/         # generated Prisma Client — gitignored (npm run db:generate)
  components/
    ui/                     # shadcn primitives
    shared/                 # cross-feature components (PageHeader, EmptyState, etc.)
  hooks/                    # e.g. useServerAction
prisma/
  schema.prisma             # datasource + prisma-client generator (+ migrations/ once created)
prisma.config.ts            # Prisma 7 config: datasource url from DATABASE_URL
```

---

## 5. Coding Standards

- **No `any`.** Use precise types, generics, or `unknown` + narrowing.
- **No TypeScript `enum`.** Use union types or `as const` objects. (Prisma schema enums are fine.)
- **No `default export`.** Named exports everywhere (Next route files excepted where the framework requires default).
- **SOLID + clean, ESLint-clean, strict TS.** No unused code, no dead abstractions (apply DRY judgmentally — extract shared behavior, keep distinct shapes inline).
- **Icons:** prefer `@tabler/icons-react` in feature code (install when first needed). The scaffold currently ships `lucide-react` as the shadcn default; migrate deliberately, don't mix per-feature.
- **Outbound HTTP** goes through `lib/http.ts` (Axios wrapper) or an official SDK — never raw `fetch` scattered across services.
- **Server/client boundary:** call `serializeForClient()` on data in server pages before passing to client components (no Prisma `Decimal`/`Date` leaking to the client).

---

## 6. Data & Validation

- **Zod schemas** live in `lib/validators/[domain].ts`, composed from a shared `lib/validators/shared.ts`.
- Every server action input is validated against a Zod schema at the boundary.
- **Prisma schema** (`prisma/schema.prisma`) is the DB source of truth once the data layer is added. Prefer **additive migrations**. **Never hard-reset the database** (no `migrate reset`, no `db push --force-reset`, no `DROP SCHEMA`) — it wipes auth sessions and breaks local dev. If a destructive change is unavoidable, ask first.

---

## 7. Server Actions

- Wrap actions with `withValidation()` from `actions/helpers.ts`.
- Actions return a typed **`ActionResult<T>`** (discriminated success/error), never throw to the UI.
- Actions **validate + delegate to a service** — no business logic or Prisma access inside an action.
- Client components call actions via the **`useServerAction`** hook (loading/error/result state).

---

## 8. Components & UI

- Build from **shadcn/ui** primitives (`components/ui`) + `@base-ui/react`.
- Reuse **shared components** from `components/shared` (PageHeader, EmptyState, ConfirmDeleteDialog, DataTable, etc.) — create one there when a pattern is used by 2+ features.
- Tailwind v4 for styling. Keep screens fast and glanceable — this UI is used during a live service rush (see the `staff` agent).

---

## 9. Testing — TDD (mandatory)

- **Write tests first.** For every new feature, author `[name].spec.ts` defining expected behavior, then implement to green. Red → Green → Refactor.
- Every new **service, repository, action, hook, and utility** has a **co-located `.spec.ts`**.
- Run the full test suite before marking any task complete. **Zero failures required.**
- After a change batch, run: typecheck + lint + tests (add the scripts once a runner is installed).

---

## 10. Restaurant Domain Model (reference)

Core entities the schema/services will revolve around:

| Area | Entities |
|---|---|
| **Menu** | `Category`, `MenuItem`, `Modifier` / `ModifierGroup`, price/availability |
| **Orders** | `Order` (channel: dine-in / takeaway / delivery), `OrderItem`, item status, coursing |
| **Service** | `Table` / floor area, `KOT` (kitchen order ticket) / KDS state, `Reservation` |
| **Billing** | `Bill` / `Payment` (cash / card / UPI / wallet / split), voids, comps, discounts, taxes |
| **Inventory** | `StockItem` / SKU, `Recipe` / BOM (auto-depletion on sale), `Wastage`, unit + yield handling |
| **Purchasing** | `Supplier`, `PurchaseOrder`, goods receipt, reorder levels, stock transfers (commissary → outlet) |
| **People** | `User` / `Staff` (roles: owner, manager, cashier, server, kitchen, stores), audit trail |
| **Multi-outlet** | `Outlet`, per-outlet config, roll-up reporting |

Key flows to keep correct: **order lifecycle → KOT/KDS → billing/settlement**, and **sale → recipe-based stock depletion → variance/reorder**. Design for **offline-tolerant billing** and **rush-speed UX** (few taps, batch actions) — these are existential for restaurant users.

---

## 11. Implementation Workflow

1. Clarify the business goal / restaurant workflow first.
2. Build **bottom-up**: Prisma schema → repository (+spec) → service (+spec) → action (+spec) → UI.
3. Write the **`.spec.ts` first** for each layer.
4. Validate with typecheck + lint + tests before marking done.
5. Update `MEMORY.md` at the end of significant sessions (decisions, completed work, pending context).

---

## 12. Agents Available (`.github/agents`)

| Agent | Use for |
|---|---|
| `buyer` | Stress-test features/UX/pricing/marketing against 6 restaurant-owner personas |
| `staff` | Evaluate flows/screens against 5 daily floor & kitchen operators (speed, rush, offline) |
| `dharmendra` | Senior architecture & full-stack engineering guidance |

> Note: `.github/copilot-instructions.md` references "AGENT.md"; the live standards file is **this file (`AGENTS.md`)**, imported by `CLAUDE.md` together with `MEMORY.md`.
