# Kitchen Display (KDS) — v1

> Kitchen staff sign in (existing `/u/[username]` login) and see live tickets from the floor, then advance each ticket **Waiting → Preparing → Ready**. Waiter + manager see the status to run food fast.
> Layered (UI → Actions → Services → Repositories → DB), TDD-first. Additive migration only.
> **Status: SHIPPED (2026-07-19). All 7 phases complete; 390 tests green.**

---

## SHIPPED — what landed

- **Migration** `20260719104015_add_line_prep_states` — additive enum values `PREPARING`, `PREPARED` on `OrderLineState`.
- **Repo** ([order.repository.ts](src/repositories/order.repository.ts)): `LineState` union extended; `lineCreate` now stamps a **single** `firedAt` per batch (enables add-on grouping); new `advanceLineStates(orderId, from, to)` bulk `updateMany`.
- **Lib** ([kitchen.ts](src/lib/kitchen.ts), client-safe): `deriveKitchenStatus(states)` (→ WAITING/PREPARING/READY/null), `kitchenAdvanceLabel(states)` (→ "Start"/"Mark ready"/null), `KITCHEN_STATUS_LABEL`, `KITCHEN_ACTIVE_STATES`.
- **Types** ([kitchen.ts](src/types/kitchen.ts)): `KitchenTicketDTO/Batch/Line`. DTO `OrderLineState` widened.
- **Service** ([kitchen.service.ts](src/services/kitchen.service.ts)): `listKitchenTickets` (OPEN orders w/ active lines, oldest-first, batched by `firedAt`, first batch = original / later = `isAddOn`), `advanceTicket` (FIRED→PREPARING else PREPARING→PREPARED), `markPickedUp` (PREPARED→SERVED). Reuses `loadOwnedOrder`.
- **Actions** ([kitchen.actions.ts](src/actions/kitchen.actions.ts)): `advanceTicketAction` (role KITCHEN), `markPickedUpAction` (role WAITER) via `withStaffValidation` + `kitchenTicketSchema`.
- **KDS UI** ([kitchen-display.tsx](src/components/kitchen/kitchen-display.tsx)): single vertical list of ticket cards, elapsed timer, status pill, ＋Added add-on group, one big advance button; ~10s polling via `router.refresh()`. Wired into the KITCHEN branch of [/u/[username]](src/app/u/[username]/page.tsx) (replaced the old `StaffHome` stub).
- **Status visibility**: shared [KitchenStatusBadge](src/components/shared/kitchen-status-badge.tsx) on waiter home rows, manager open-tickets rows, and the waiter add-items screen (+ **Picked up** button when a ticket is Ready).

---


---

## 0. Goal (your ask)

- **Kitchen** logs in → **KDS**: sees orders (by table) with item details, prepares, and updates progress.
- Progress: **Waiting → Preparing → Prepared** (simple, few taps).
- **Waiter + manager** see each order's status → run it to the customer fast; on delay the waiter can see it (and optionally nudge the kitchen).
- **Simple buttons, simple flow.**

---

## 1. How it maps to what exists

- Orders already **fire** items to the kitchen: an `OrderItem` gets `state = FIRED` + a `firedAt` timestamp when the waiter taps Send. Existing line states: `UNSENT → FIRED → SERVED → VOID`.
- **Proposal:** extend `OrderLineState` with two states so the whole prep lifecycle lives in one place:
  `UNSENT → FIRED (= Waiting) → PREPARING → PREPARED → SERVED → VOID`
  - **Waiting** = `FIRED` (sent, not started) — no data change, just a label.
  - **Preparing** / **Prepared** = new states the kitchen sets.
  - **Served** = existing state — set when the waiter/kitchen marks it delivered/picked-up; clears from the KDS.
  - Additive enum change (safe). No new Order column — an order's **kitchen status is derived** from its line states.
- The **waiter/manager "status"** shown per order is derived: any `PREPARING` → *Preparing*; all active lines `PREPARED` → *Ready*; else *Waiting*; all `SERVED/VOID` → done (off the board).

---

## 2. Proposed design (pending your answers in §5)

### KDS screen (`/u/[username]` when role = KITCHEN — replaces today's stub)
- A live list of **active tickets** = orders that have any `FIRED / PREPARING / PREPARED` line (not fully served/void).
- Each **ticket card**: table label (or `Takeaway #`), **elapsed time** since fired, the **item list** (qty × name, variant, **modifiers/notes bold** so nothing is missed), and **one big button** that advances the whole ticket:
  - `Start` → Preparing → `Mark ready` → Prepared → (clears on pickup).
- **Add-on items** a waiter adds later (a new fired batch, later `firedAt`) show as a **flagged "＋ ADDED" group** on the same table's card — never a silent reprint.
- **Auto-refresh** by light polling (~10 s) since the stack has no websockets.

### Waiter + manager visibility
- **Waiter** home open-orders + order screen: a **status badge** (Waiting / Preparing / Ready) + elapsed time per order; add-on items show their own state.
- **Manager** dashboard orders list: a **kitchen-status column**.

### Actions (KITCHEN-gated, `withStaffValidation({ role: "KITCHEN" })`)
- `advanceTicket(orderId)` — bulk-advance the ticket's active lines to the next state (Waiting→Preparing, Preparing→Prepared), attributed to the kitchen staff.
- `markPickedUp(orderId)` — Prepared → `SERVED`, clears the ticket. (Or the waiter does this — see Q2.)

---

## 3. Security / roles

- KDS + status actions are **KITCHEN-role-gated** (reuses `getStaffContextOrNull` + `withStaffValidation`). Restaurant-scoped via the order's `restaurantId`.
- Kitchen **cannot** void/comp/discount/edit prices (same hard line as the waiter). Status changes only.
- No new attribution table needed unless you want a "who marked ready" audit (can reuse the staff context).

---

## 4. Build outline (once confirmed)

1. Migration: add `PREPARING`, `PREPARED` to `OrderLineState` (additive).
2. Repo + service: `setLineStatesForOrder(orderId, from→to)`, kitchen status derivation, `listKitchenTickets(restaurantId)`.
3. Actions: `advanceTicketAction`, `markPickedUpAction` (KITCHEN-gated) + specs.
4. UI: KDS board (kitchen home), status badges on waiter home/order screen + manager orders.
5. Polling refresh, tsc + eslint + vitest, smoke, docs.

---

## 5. Locked decisions (confirmed 2026-07-19)

1. **Granularity — whole ticket, one tap.** The kitchen advances the entire order at once (Start → Mark ready). Stored per-line, but the button acts on all active lines.
2. **Clearing a Ready ticket — the waiter taps “Picked up”** (→ `SERVED`), which removes it from the KDS. Kitchen just marks Ready.
3. **Waiter nudge — v1 = visibility only** (status badge + elapsed timer). No urgent-flag/nudge button yet.
4. **Live updates — auto-refresh by polling ~every 10 s** (no websockets).
5. **Add-ons — separate flagged “＋ ADDED” group** on the ticket (later fired batch), never a silent reprint.
6. **Layout — single vertical list of ticket cards**, each with one big status button.
