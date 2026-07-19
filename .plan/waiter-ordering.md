# Waiter Ordering (v1) — the work screen behind the staff login

> A signed-in **waiter** (mobile, `/u/[username]`) takes a **new order** for a table/takeaway and **adds to an existing open order**, in a few taps. Reuses the dashboard POS business logic (`order.service`, `getMenu`, tables); mobile-first UI.
> Layered (UI → Actions → Services → Repositories → DB), TDD-first. Additive migrations only.
> **Status: SHIPPED (2026-07-19).** Schema→service→helper→actions→UI landed; migration `add_order_staff_attribution`; tsc + eslint + 364 tests green. D1 resilient-online · D2 dine-in+takeaway · D3 `placedByStaffId` · D4/D5 waiter has zero price/void/settle powers · D6 table grid · D7 one-tap items + sheet modifiers.
> Planned with the **buyer** (6 owners) + **staff** (5 floor/kitchen) agents — §1.

---

## 0. TL;DR

- Waiter logs in (name → PIN, already built) and lands on **their open-tables list** (home). Tap a table → add items → **Send**. Or **New order** → pick table (or Takeaway) → add items → Send.
- **Adding to an open table uses the same screen** as a new order. Everything sends to the kitchen (fire-all).
- **Customer phone** is captured **after**, optional, one-tap skip, default-off for dine-in — never blocks Send.
- **Waiters take orders only.** Voids / comps / discounts / settlement stay with the manager (dashboard) — hard gate.
- Reuses `order.service.ts` (`createOrder`/`addItems`/`fireOrder`/`listOrders`), `getMenu`, `getTables`, existing Zod schemas. New: a **staff auth wrapper**, **staff order actions**, per-order **staff attribution**, and a **mobile ordering UI** under `/u/[username]`.

---

## 1. What the agents said (condensed)

**Both panels agree:**
1. **Open-tables list is the home screen** — re-open any table in ≤2 taps; show only active/open orders with an age timer. *(the make-or-break for adoption)*
2. **One-tap add for plain items**; a bottom **sheet** only when the item has variants/modifiers. Qty via re-tap or a small ± on the cart line. ≤3–4 taps to add a common item.
3. **Phone = after, optional, one-tap skip, default-off dine-in.** Mandatory phone or an order-type gate before adding items = instant abandonment.
4. **Table-first for dine-in** (default), **pick-from-list** (grid grouped by section, occupied dot + timer) — not free-text (keeps reports clean). Takeaway skips the table step.
5. **Fire-all by default.** Formal coursing = fine-dining-only → cut.
6. **Waiter = create + add items only.** Every void/comp/discount → **manager PIN + audit**. A waiter must never touch price. *(universal, non-negotiable)*
7. **Loud Send confirmation + never lose the order.** The #1 flop risk both cite is a **Send that fails silently on flaky wifi** → "Queued/Sent ✓", fired items lock/gray.
8. **Auto-deplete stock** on every sent item, same as the dashboard POS (a second entry point can't bypass depletion). *(reused service already does this)*
9. Added items must reach a future KDS **clearly flagged as an add-on** ("T6 ADD"), modifiers/notes **bold** — not a full reprint. *(KDS is a later build; we only ensure new items are marked UNSENT→FIRED with `firedAt`.)*

**Notable dissent:** Sofia (fine dining) wants a real floor map + coursing + guest CRM → **phase 2**. Linda (bar) wants open tabs + payment → **phase 2**. Anita (QSR) wants **Takeaway-first, no table step** → handled by remembering last order-type. Marcus (cloud kitchen) — irrelevant (no waiters).

---

## 2. Decisions

### Locked (your brief + agent consensus)
| # | Decision |
|---|---|
| L1 | Waiter can **create a new order** (table or takeaway) and **add to an existing open order**, on mobile, in a few taps. |
| L2 | **Phone capture is after, optional, skippable, default-off for dine-in** — never blocks the order. |
| L3 | Feels like the dashboard POS but **mobile-first**; reuses its order/menu/table logic + stock depletion. |
| L4 | **Fire-all on Send** (no coursing in v1). |

### Open — please verify before I build
| # | Question | Recommendation |
|---|---|---|
| **D1** | **Offline.** Both agents call true offline the #1 must / flop-risk. Full offline-first (service worker + IndexedDB queue + sync) is a large build that would dwarf v1. | **v1 = "resilient online":** the cart lives **locally** until you tap Send; Send is a single **idempotent** call (existing `idempotencyKey`) with **auto-retry on reconnect** and loud **Queued → Sent ✓ / Failed-tap-to-retry** states, so an order is never silently lost. **True offline-first (compose with zero connectivity) = phase 2.** *This is the biggest scope call — tell me if you want full offline in v1.* |
| **D2** | **Order types for the waiter.** | **Dine-in + Takeaway only.** No delivery on the waiter screen (aggregators live elsewhere). |
| **D3** | **Attribution — who took the order?** `Order.placedById` is an FK to **User** (manager); a waiter is a **Staff**, so it can't go there. | Add **`placedByStaffId` (FK Staff, nullable)** + make `placedById` nullable; waiter orders set `placedByStaffId`. Gives owners the "who rang it" audit they demanded. Additive migration. |
| **D4** | **Waiter price/void powers.** | **None in v1.** The waiter screen has **no** comp toggle, discount, void-of-sent-item, or settlement. Removing an **unsent** line from the cart before Send is fine. Voids/comps/discounts/settle stay in the **manager dashboard**. (Tableside manager-PIN void = phase 2.) |
| **D5** | **Billing / settlement.** | **Waiter does not settle/take payment in v1** — order-taking only. Cashier/manager settles from the dashboard. (Bar tabs + tender = phase 2.) |
| **D6** | **Table entry.** | **Pick-from-list** grid grouped by `section`, thumb-sized, with **occupied dot + age timer**; free-text search only as a fallback for big rooms. |
| **D7** | **Menu UX.** | **Sticky search + horizontal category chips + single/2-col item list**, **one-tap add for plain items**, **bottom-sheet** for variants/modifiers/qty/note, **pinned bottom cart/Send bar**. |

---

## 3. Reuse map (what already exists — no rebuild)

| Need | Reuse |
|---|---|
| Create + fire order | `order.service.createOrder(ctx, input)` (idempotent, snapshots menu, fires items, **depletes stock**) |
| Add to open order | `order.service.addItems(ctx, input)` (UNSENT) + `fireOrder(ctx, orderId)` |
| List my open tables | `order.service.listOrders(restaurantId, ["OPEN"])` |
| Load one order | `order.service.getOrder(restaurantId, orderId)` |
| Menu (avail/86, variants, modifiers, tax) | `menu-item.service.getMenu(restaurantId)` → `MenuDTO` |
| Tables + occupied map | `table.service.getTables(restaurantId)`; occupied `Record<tableId, orderId>` (derive from open orders) |
| Validation | `lib/validators/order.ts` — `createOrderSchema`, `addItemsSchema`, `cartLineSchema` (all reusable as-is) |
| Bill preview in cart | existing `computeBill` used by the POS |

**Context shim:** `order.service` takes `OrderContext { restaurantId, userId }`. Waiter actions supply `restaurantId` from the staff session and route attribution to `placedByStaffId` (D3).

---

## 4. Architecture (new pieces only)

### 4a. Data (additive migration `add_order_staff_attribution` — D3)
```prisma
model Order {
  // …existing…
  placedById      String?   // now nullable (manager path)
  placedByStaffId String?   // NEW — waiter who created (FK Staff)
  placedByStaff   Staff?    @relation(fields: [placedByStaffId], references: [id])
}
```
(`addItems` doesn’t currently attribute per-line; per-line staff attribution stays out of v1 — order-level is enough for "who opened the table".)

### 4b. Staff auth wrapper — `actions/helpers.ts`
- `withStaffValidation(schema, handler, opts?: { role?: StaffRole })` — mirrors `withManagerValidation` but resolves `getStaffContextOrNull()`, returns `failure("NO_STAFF_SESSION")` when absent, and (for ordering) requires `role === "WAITER"` → else `failure("STAFF_FORBIDDEN")`. Passes `StaffContext` to the handler.

### 4c. Actions — `actions/staff-order.actions.ts` (new, WAITER-gated)
- `createWaiterOrderAction` — `withStaffValidation(createOrderSchema)` → `createOrder({ restaurantId: ctx.restaurantId, staffActor: ctx.staffId }, data)`. Returns `ActionResult<OrderDTO>`.
- `addWaiterItemsAction` — `withStaffValidation(addItemsSchema)` → `addItems(...)` then `fireOrder(...)` (fire-all) → `ActionResult<OrderDTO>`. *(guard: the order must belong to `ctx.restaurantId` and be OPEN — `loadOwnedOrder` already enforces restaurant scope.)*
- `listWaiterOpenOrdersAction` **or** load via RSC (preferred) — the home page is a Server Component that calls `listOrders(restaurantId, ["OPEN"])`.
- **No** void/comp/discount/settle actions for staff (D4/D5).

> Small service tweak for D3: `createOrder`/`OrderContext` gains an optional staff actor so it writes `placedByStaffId` instead of `placedById`. One focused change + spec; the rest of `order.service` is untouched.

### 4c′. Route protection
- `/u/[username]/**` already gated by the proxy on `restro_staff`. Each ordering page also calls `getStaffContextOrNull()` and requires `role === "WAITER"` (kitchen → its KDS stub); verifies the URL username maps to `ctx.restaurantId`.

### 4d. UI (under `app/u/[username]`)
- **`/u/[username]` (home)** — role split:
  - **WAITER** → `WaiterHome`: **open-tables list** (big rows: `T6 · 4 items · 12 min`, tap → order screen) + **New order** button. RSC loads `listOrders(restaurantId,["OPEN"])` + filters/labels; client for interactivity.
  - **KITCHEN** → existing KDS stub (unchanged; real KDS later).
- **`/u/[username]/order/new`** (+ `?type=DINE_IN|TAKEAWAY`) — `OrderBuilder` in "new" mode: order-type toggle (default = last used / `services.defaultType`), **table grid** (dine-in), then the menu + cart.
- **`/u/[username]/order/[orderId]`** — `OrderBuilder` in "add" mode: header shows the table + existing items (fired, greyed/locked), same menu + cart, **Send** = `addWaiterItemsAction`.
- **Shared components** `components/waiter/`:
  - `waiter-home.tsx` (open-tables list + New order)
  - `order-builder.tsx` (orchestrates type → table → menu → cart → send; holds local cart via a `useOrderCart`-style hook; **optimistic + idempotent + retry** send states)
  - `table-grid.tsx` (section-grouped, occupied dot + timer, thumb targets)
  - `menu-browser.tsx` (sticky search + category chips + item list, one-tap add)
  - `item-sheet.tsx` (bottom sheet: variants, modifier chips, qty, note — only for items that need it)
  - `cart-bar.tsx` (pinned bottom: item count + total + Send; expandable cart with ± / remove **unsent** lines)
  - `phone-capture.tsx` (post-order skippable chip/sheet)
- **Mobile-first**: reuse the login redesign patterns — `min-h-svh`, 16px inputs (no iOS zoom), ≥44px tap targets, `touch-manipulation`, bottom-pinned actions, bottom sheets (not center dialogs).

---

## 5. UX flows

**New dine-in order (target ~6 taps):**
`Home → New order → tap Table 6 → tap items (1 tap each, plain) → Send ✓`
Phone is an optional chip after Send.

**Add to a running table (target ~2 taps to re-open):**
`Home → tap "T6 · 4 items" → tap items → Send ✓` (new items flagged for the kitchen).

**Takeaway (Anita):** `Home → New order (defaults to Takeaway if last used) → items → Send → optional phone`.

**Send resilience (D1):** tap Send → row shows **Queued** → on success **Sent ✓** + fired lines lock; on failure **Tap to retry** (same idempotency key, no dupes).

---

## 6. Security & control (owner asks)

- **Waiter can only create/add.** No void/comp/discount/settle exposed; server actions for those remain `withManagerValidation` (a waiter session literally can’t call them). (D4/D5)
- **Attribution:** every waiter order stamps `placedByStaffId` → owner audit "who opened T6". (D3)
- **Scope:** actions are `WAITER`-role-gated and restaurant-scoped (`loadOwnedOrder`); a `spice12` waiter can’t touch another restaurant’s orders.
- **Stock integrity:** depletion via the reused service — no bypass (Iqbal). 
- **Idempotency:** `idempotencyKey` prevents double-send on retry/flaky wifi.

---

## 7. Build order (bottom-up, TDD — write `.spec.ts` first)

1. Migration `add_order_staff_attribution` (+ generate).
2. `order.service` staff-actor tweak (`placedByStaffId`) + repo write + specs (attribution, still depletes/fires).
3. `withStaffValidation` in `actions/helpers.ts` (+ spec: no session, wrong role, happy path).
4. `actions/staff-order.actions.ts` (+ spec: create as waiter, add+fire, kitchen role forbidden, cross-restaurant blocked, invalid payload).
5. UI: `waiter-home` → `order-builder` (table-grid, menu-browser, item-sheet, cart-bar, phone-capture). Wire `/u/[username]`, `/order/new`, `/order/[orderId]`.
6. `tsc + eslint + vitest`; restart dev; smoke the waiter routes (staff-gated) on a mobile viewport.
7. Mark SHIPPED + update `MEMORY.md`.

---

## 8. Test matrix (key cases)

- Service: waiter `createOrder` sets `placedByStaffId` (not `placedById`), fires items, depletes stock; `addItems`+`fireOrder` marks new lines FIRED.
- `withStaffValidation`: rejects no-session (`NO_STAFF_SESSION`), rejects KITCHEN for ordering (`STAFF_FORBIDDEN`), passes WAITER.
- Actions: create/add happy path; add to another restaurant’s order rejected; malformed cart rejected; idempotent re-send returns the same order.
- (UI) cart: one-tap add ×1, re-tap → ×2, remove **unsent** line; Send disabled on empty cart; phone skip never blocks.

---

## 9. Out of scope (v1) → phase 2+

- **True offline-first** (compose orders with zero connectivity; IndexedDB queue + service worker/PWA) — D1; the agents’ ultimate ask.
- **KDS** (kitchen display) — the other half; add-on tickets must land bold/flagged (Vikram). Kitchen home stays a stub.
- **Coursing / fire-timing**, **split-by-seat**, **floor map + live table status** (Sofia).
- **Open bar tabs + waiter-side payment/settlement** (Linda).
- **Guest CRM / loyalty** at the table (Sofia/Rajesh: don’t slow the flow).
- **Per-line staff attribution**, tableside **manager-PIN** void/comp, delivery entry, covers/pax count.
