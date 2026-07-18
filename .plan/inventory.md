# Inventory (v1)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> Builds on Menu + POS/Orders. Layered (UI → Actions → Services → Repositories → DB), TDD-first.
> **Status: SHIPPED (2026-07-19).** Stock log + 3-verb adjustments + bulk grids + recipe/BOM auto-depletion + dashboard badge live. 268 tests pass. See `MEMORY.md` → "Inventory" for the as-built summary.

---

## 0. TL;DR — what the agents changed

Both panels were blunt and aligned:

- **This is a manual stock LOG, not "real-time inventory."** Without auto-depletion the on-hand number drifts the moment a sale rings up — so we position it honestly (no "real-time" promise) and lead with a low-effort **count** workflow. 3/6 owners adopt v1 as scoped; the other 3 (multi-outlet/cloud) want recipes first — which everyone agrees is v2.
- **Bulk grid entry is make-or-break.** A delivery is 30–40 lines; a count is 200 items. Per-item, one-at-a-time forms = the stores clerk keeps his paper GRN. Ship **bulk receive** + **count mode** grids or don't ship.
- **On-hand is a running total of *typed adjustments* — never a directly-editable field.** Every change is Receive (+) / Waste (−) / Correction (=), each stamped who/when/qty/reason. Letting anyone overwrite on-hand kills the audit trail and invites fat-finger.
- **Reasons = canned chips** (spoiled / expired / breakage / prep loss / comp) + optional note. Free-text-only ⇒ nobody logs ⇒ variance data is worthless. Corrections need a reason too.
- **Decimals / partial units** are non-negotiable (half bottle, 2.5 kg).
- Surface a **glanceable "N items low" badge on the dashboard**; keep the workflow in the inventory screen.
- **Defer (0/6 want in v1):** recipe/BOM auto-depletion, suppliers-as-entities + purchase orders + goods-receipt, multi-outlet transfers, batch/expiry, variance reports — **but capture clean audit data now** so they bolt on without a destructive migration.

---

## 1. Scope (v1)

**In**
1. **Stock items CRUD** — required: `name`, `unit`, opening `on-hand`. Optional: `category`, `reorderLevel`, `parLevel`, `costPerUnit`, `supplier` (free-text string, **not** an entity), `notes`, active toggle. Soft-delete.
2. **Adjustments (the spine)** — **Receive (+)**, **Waste (−)**, **Correction/Count (=)**. Each writes a `StockMovement` (type, signed delta, resulting on-hand, reason, note, user, timestamp). On-hand = running total; never edited directly.
3. **Bulk receive** (grid: item + qty per row, one save) and **Count mode** (grid: all active items, editable counted-on-hand, one save → correction movements). ← the adoption-deciding features.
4. **Low-stock view** (at/under reorder level) + a **dashboard "N items low" badge** linking in.
5. **Recipe / BOM + auto-depletion** (owner-confirmed): each `MenuItem` has a recipe (`RecipeComponent[]` = stock item + qty in stock unit). Placing an order **deducts** ingredients (`SALE_DEPLETION` movements, linked to the order); **voiding a line/order restores** them. **Never blocks a sale** — on-hand may go negative; depletion is best-effort and never fails order creation. Items with no recipe simply don't deplete. Comp lines still consume.
6. Sidebar **Inventory → `/dashboard/inventory`**.

**Deferred (explicitly out)**
- **Suppliers as entities + Purchase Orders + goods-receipt** → v2/v3 (0/6 want it; manual receive is enough).
- **Multi-outlet transfers** → v2 (stock is `restaurantId`-scoped = per-outlet today).
- **Variance reports** (theoretical vs counted), **per-variant / per-modifier recipes**, **unit conversion** (purchase-unit≠stock-unit), **batch/expiry**, **stock→menu-86 auto-block** → later. Recipe qty is expressed in the stock item's own unit (no conversion in v1).

---

## 2. Data model

```prisma
enum StockUnit {
  KG
  GRAM
  LITRE
  ML
  PIECE
  PACK
  BOTTLE
  DOZEN
}

enum StockMovementType {
  RECEIVE
  WASTE
  CORRECTION
  SALE_DEPLETION // order placed (negative) / void restore (positive)
}

model StockItem {
  id           String    @id @default(cuid())
  restaurantId String
  name         String
  unit         StockUnit
  category     String?
  onHand       Decimal   @default(0) @db.Decimal(12, 3)
  reorderLevel Decimal?  @db.Decimal(12, 3)
  parLevel     Decimal?  @db.Decimal(12, 3)
  costPerUnit  Decimal?  @db.Decimal(12, 2)
  supplier     String?
  notes        String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  restaurant Restaurant      @relation(fields: [restaurantId], references: [id])
  movements  StockMovement[]

  @@unique([restaurantId, name])
  @@index([restaurantId])
}

model StockMovement {
  id          String            @id @default(cuid())
  restaurantId String
  stockItemId String
  type        StockMovementType
  quantity    Decimal           @db.Decimal(12, 3) // signed delta applied
  resultingOnHand Decimal       @db.Decimal(12, 3) // snapshot after applying
  reason      String?
  note        String?
  orderId     String?           // set for SALE_DEPLETION (audit + void-restore lookup)
  createdById String
  createdAt   DateTime          @default(now())

  stockItem StockItem @relation(fields: [stockItemId], references: [id])

  @@index([stockItemId])
  @@index([restaurantId, createdAt])
  @@index([orderId])
}

model RecipeComponent {
  id          String   @id @default(cuid())
  menuItemId  String
  stockItemId String
  quantity    Decimal  @db.Decimal(12, 3) // in the stock item's unit
  createdAt   DateTime @default(now())

  menuItem  MenuItem  @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  stockItem StockItem @relation(fields: [stockItemId], references: [id], onDelete: Cascade)

  @@unique([menuItemId, stockItemId])
  @@index([menuItemId])
  @@index([stockItemId])
}
```

- `Restaurant` gains `stockItems StockItem[]`. Migration **`add_inventory`** (additive, no reset).
- **Quantities are `Decimal(12,3)`** → partial units. Money `Decimal(12,2)`.
- **Opening stock:** creating an item with on-hand > 0 records an opening `CORRECTION` movement (reason "Opening stock") in the same transaction, so on-hand always equals the movement history.

---

## 3. Layers (bottom-up, TDD)

- **Validators** `lib/validators/inventory.ts`
  - `createStockItemSchema` (name 1–120, unit enum, category?, `openingOnHand` ≥0 default 0, reorder/par/cost ≥0 optional, supplier?, notes?, isActive default true).
  - `updateStockItemSchema` (id + editable fields; **no** onHand — on-hand only moves via adjustments).
  - `deleteStockItemSchema` (id).
  - `adjustStockSchema` (stockItemId, `type` RECEIVE|WASTE, `quantity` >0, reason?, note?).
  - `countStockSchema` (rows: `{ stockItemId, countedOnHand ≥0 }[]`, note?).
  - `bulkReceiveSchema` (rows: `{ stockItemId, quantity >0 }[]`).
  - Reason presets are a client const (WASTE_REASONS); stored as the string.
- **Repository** `repositories/stock.repository.ts`
  - `createStockItem`, `updateStockItem`, `softDeleteStockItem`, `findStockItemById`, `findStockItemByName`, `findStockItemsByRestaurant({includeInactive})`, `lowStockCount`.
  - `applyMovement(tx-aware)`: **`prisma.$transaction`** — set/increment `onHand`, create `StockMovement` with `resultingOnHand`. `applyMovements` (bulk, one transaction).
  - `findMovements(stockItemId | restaurantId, limit)`.
- **Service** `services/stock.service.ts` (+ `types/inventory.ts`)
  - `getStock(restaurantId)` → `StockItemDTO[]` (Decimals→number, `isLow` computed).
  - `createStockItem` (opening movement), `updateStockItem`, `deleteStockItem` — ownership + `STOCK_NAME_TAKEN`/`STOCK_NOT_FOUND`/`STOCK_FORBIDDEN` (revive soft-deleted name like tables).
  - `receiveStock` / `wasteStock` (single), `bulkReceive`, `countStock` (rows → correction deltas). All compute signed delta + resulting on-hand; skip zero-delta rows.
  - `listMovements`, `getLowStock` / `lowStockCount`.
  - Context `{ restaurantId, userId }` → movement `createdById`.
- **Actions** `actions/inventory.actions.ts` (`withManagerValidation`): create/update/delete item, receive, waste, bulkReceive, count.
- **Recipes** `repositories/recipe.repository.ts` + `services/recipe.service.ts` (+ `recipe.actions.ts`): list/set/remove `RecipeComponent` for a menu item (`getRecipe(menuItemId)`, `setRecipeComponent`, `removeRecipeComponent`, ownership via menu item's restaurant).
- **Depletion** `services/stock-depletion.service.ts`: `depleteForLines(ctx, lines[{menuItemId, quantity}], orderId)` → aggregate recipe consumption, `increment onHand` down (allow negative), `SALE_DEPLETION` movements; `restoreForOrderLines(ctx, ...)` reverses. **Best-effort** (try/catch, never throws to the order flow).
- **Order integration** (`order.service`): after `createOrder`/`addItems` succeed → `depleteForLines(newLines)`; after `voidLine`/`voidWholeOrder` → restore. Sale is never blocked by stock.
- **Types** `types/inventory.ts`: `StockUnit`, `StockMovementType`, `StockItemDTO`, `StockMovementDTO`, `RecipeComponentDTO`.

---

## 4. UI — `/dashboard/inventory`

- **Header:** PageHeader + **Add item** · **Receive** (bulk grid) · **Count** (grid) buttons. A **low-stock summary** chip ("6 items low").
- **List** grouped by **category** (like tables/sections): each row → name, on-hand + unit, reorder/par, cost (if set), **Low badge** when ≤ reorder; row actions: **Receive** / **Waste** (quick dialogs) / **Edit** / **History** / **Remove** (soft, confirm).
- **`stock-item-dialog`** — create/edit (name, unit select, category, opening on-hand [create only], reorder, par, cost, supplier, notes, active). Mount-while-open.
- **`adjust-dialog`** — single Receive or Waste: qty + (waste) reason chips + note.
- **`bulk-receive-dialog`** — searchable grid of active items, qty per row, one save → `bulkReceive`.
- **`count-dialog`** — grid of active items, editable counted-on-hand prefilled with current, one save → `countStock` (only changed rows).
- **`movements-drawer/dialog`** — per-item history (type, qty, resulting, reason, who, when).
- **Dashboard:** add a small **"Inventory — N items low"** card on `/dashboard` linking to `/dashboard/inventory` (Sunita: push the signal out).
- **Recipe editor:** a **Recipe** action on each item in the **menu manager** opens a `recipe-dialog` — list components (stock item + qty + unit), add (stock-item select + qty), remove. Saves via recipe actions. (Intuitive place: "this dish → its ingredients.")
- shadcn Card/Field/Input/Select/Switch/Dialog + `useServerAction` + `sonner`. Honest copy: "Manual stock log," never "real-time."

---

## 5. Tests (TDD, co-located `.spec.ts`)

- `stock.repository.spec` — create/update/soft-delete, `applyMovement` ($transaction mock: update + movement create), low-stock query.
- `stock.service.spec` — create with **opening movement**, receive/waste deltas + resulting on-hand, **count** (correction delta), `STOCK_NAME_TAKEN` + revive, ownership, `isLow` computation, bulk skip-zero.
- `inventory.actions.spec` — delegation + `NO_RESTAURANT` + validation rejects (negative qty, on-hand not editable via update).
- `recipe.service.spec` — set/remove components, ownership.
- `stock-depletion.service.spec` — deplete aggregates recipe × line qty (allows negative), restore reverses, **no-recipe = no-op**, best-effort swallow.
- `order.service.spec` — extend: create/void triggers depletion/restore (mock depletion service).
- Gate: `tsc --noEmit` + `eslint src` + full `vitest run`, zero failures.

---

## 6. Decisions (resolved 2026-07-19)

1. **3-verb adjustments + on-hand = running total (never directly editable)** — ✅.
2. **Bulk Receive grid + Count grid** — ✅.
3. **Dashboard "N items low" badge** — ✅.
4. **Recipe/BOM auto-depletion** — ✅ **INCLUDED** (deplete on order, restore on void, never blocks a sale, on-hand may go negative).
5. **Deferred:** suppliers/POs, variance reports, multi-outlet transfers, per-variant/modifier recipes, unit conversion, batch/expiry.
