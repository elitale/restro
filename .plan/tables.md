# Tables (v1)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> Builds on **Orders/POS** (dine-in currently uses a free-text "Table" box; orders store a `tableLabel` string).
> Layered (UI → Actions → Services → Repositories → DB), TDD-first.
> **Status: SHIPPED (2026-07-18).** Tables CRUD + POS dine-in picker + light occupancy live. 210 tests pass. See `MEMORY.md` → "Tables" for the as-built summary.

---

## 0. TL;DR — what the agents changed

Both agent panels were emphatic and aligned:

- **A table list with no occupancy is useless.** 3/6 owners and every floor persona said they'd keep the paper chart if tapping an already-occupied table *silently* starts a second order. This is the **#1 abandon trigger** → v1 ships a **light occupancy signal + a warn-on-tap**, derived from existing open orders (cheap — we already query them).
- **Store a real `Order.tableId` FK, not just the label.** "Which check is on T12?" must be a real relation, not a fuzzy string match. Keep `tableLabel` as a denormalized snapshot (for KOT/reports even if the table is later renamed/removed).
- **Soft-delete tables.** Never hard-delete a table with order history (orphans reports).
- **Don't force the table step on non-dine-in.** Takeaway stays the default; the table picker only shows for Dine-in. (Already true — keep it.)
- **Keep it fast.** Big tap targets, sections expanded, no deep scroll. The list must beat typing "T7".
- **Cut:** drag-reorder UI, reservations, transfer/merge/tabs, floor-map layout, multi-outlet clone/templates → all deferred.

---

## 1. Scope (locked)

**In v1**
1. Manager **Tables CRUD** at `/dashboard/tables`: label, optional seats, optional section, active toggle. Soft-delete.
2. Real **`Order.tableId`** link (+ keep `tableLabel` snapshot).
3. **POS Dine-in table picker** (`/dashboard/pos`): tappable list grouped by section, replacing the free-text box (free-text stays as fallback when no tables are configured).
4. **Light occupancy:** tables with an open/unsettled order show an "occupied" dot; tapping one opens a **confirm** with *Open existing order* / *New order anyway*.
5. Sidebar **Tables → `/dashboard/tables`** (currently `#`).

**Deferred (v1.1+)**
- Occupancy *state machine* (free / seated / dirty / reserved, timers).
- Table tabs: add-a-round to a table's existing order directly from POS, transfer/merge.
- Reservations, floor-map layout, drag-reorder, table QR ordering.
- **Bulk quick-add** ("T1–T20" range) — deferred; single add only in v1.
- Multi-outlet clone/templates (tables are already `restaurantId`-scoped = per-outlet today).

---

## 2. Data model

New model (named `DiningTable` — avoids the SQL-reserved `table`):

```prisma
model DiningTable {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  label        String
  seats        Int?
  section      String?
  sortOrder    Int        @default(0)
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?
  orders       Order[]

  @@unique([restaurantId, label])   // labels unique per restaurant
  @@index([restaurantId])
}
```

- `Restaurant` gets `tables DiningTable[]`.
- `Order` gets `tableId String?` + `table DiningTable? @relation(...)` + `@@index([tableId])`. (`tableLabel` snapshot already exists.)
- Migration: **`add_tables`** (additive — new model + nullable `Order.tableId`). No reset.

---

## 3. Layers (bottom-up, TDD)

- **Validators** `lib/validators/table.ts`
  - `createTableSchema` — `label` (1–40), `seats` (int 1–99, optional), `section` (≤40, optional), `isActive` default true.
  - `updateTableSchema` (`id` + editable fields), `deleteTableSchema` (`id`).
  - **Extend `createOrderSchema`** with `tableId: idSchema.optional()`.

- **Repository** `repositories/table.repository.ts` (Prisma only)
  - `createTable`, `updateTable`, `softDeleteTable`, `findTableById`, `findTablesByRestaurant(restaurantId, { includeInactive })`, `maxSortOrder`. Duplicate-label → surfaced as a typed service error.

- **Service** `services/table.service.ts` (+ `types/table.ts` `TableDTO { id, label, seats, section, isActive }`)
  - `getTables(restaurantId)` → active tables, sorted by `(section, sortOrder, label)` → `TableDTO[]`.
  - `listTablesForManager(restaurantId)` → includes inactive (for the manager page).
  - `createTable` / `updateTable` / `deleteTable` — ownership via `{ restaurantId, userId }`, `TABLE_LABEL_TAKEN` / `TABLE_NOT_FOUND` / `TABLE_FORBIDDEN` errors.

- **Order service change** (`services/order.service.ts`)
  - `createOrder`: if `input.tableId` → `findTableById` + verify restaurant + not deleted → set `tableId` and **authoritative** `tableLabel = table.label`; else fall back to free-text `input.tableLabel`. Persist `tableId`.
  - `mapOrder`: add `tableId` to `OrderDTO` (POS uses it to map occupancy).

- **Actions** `actions/table.actions.ts` (`withManagerValidation`)
  - `createTableAction`, `updateTableAction`, `deleteTableAction`.

---

## 4. UI

### `/dashboard/tables` (manager)
- `PageHeader` + **Add table** button.
- Tables grouped by **section** (ungrouped bucket = "No section"), each row: label · seats (if set) · active/inactive badge, **Edit** / **Delete** (soft, confirm).
- `components/tables/`: `tables-manager` (client), `table-dialog` (create/edit). Mirror the menu dialogs (mount-while-open, `useServerAction`, `sonner`).
- `EmptyState` when no tables ("Add your first table").

### `/dashboard/pos` (Dine-in picker)
- Page also fetches `getTables(restaurantId)` + open orders → derive **occupied set** (`tableId → openOrderId`, label fallback). Pass `tables` + `occupied` to `PosTerminal`.
- `PosTerminal` Dine-in branch:
  - If tables exist → **grouped tappable grid** (section headers, big buttons). Selected table highlighted. Occupied tables show a dot.
  - Tapping an **occupied** table → confirm dialog: **Open existing order** (→ `/dashboard/orders/{id}`) or **New order anyway** (select it).
  - If no tables configured → keep the current **free-text** input (fallback so POS never blocks).
  - `send()` includes `tableId` (selected) instead of the free-text label.

### Sidebar
- `app-sidebar.tsx`: **Tables** `#` → `/dashboard/tables`.

---

## 5. Tests (TDD, co-located `.spec.ts`)

- `table.repository.spec` — CRUD, bulk, soft-delete, list ordering, ownership (mock `@/lib/prisma`).
- `table.service.spec` — sort/group, `TABLE_LABEL_TAKEN`, ownership guards, `bulkAddTables` label generation.
- `table.actions.spec` — delegation + `NO_RESTAURANT` (mock admin+manager auth + service).
- `order.service.spec` — extend: `createOrder` with `tableId` resolves authoritative label + verifies restaurant; rejects cross-restaurant `tableId`.
- Gate: `tsc --noEmit` + `eslint src` + full `vitest run`, zero failures.

---

## 6. Decisions (resolved 2026-07-18)

1. **Light occupancy + warn-on-tap (with "open existing order")** — ✅ in v1.
2. **Real `Order.tableId` FK** (+ keep `tableLabel` snapshot) — ✅ in v1.
3. **Bulk quick-add ("T1–T20")** — ✗ deferred (single add only).
4. **`seats` + `section`** (both optional) — ✅ in v1.
