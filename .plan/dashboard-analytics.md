# Plan: Complete the manager dashboard (`/dashboard`) — day + month analytics

> Planned with the **buyer** (6 owner personas) and **staff** (floor/kitchen) agents. Status: **SHIPPED 2026-07-20** — decisions locked (§7), built bottom-up TDD. Suite 484 green · tsc/eslint clean · `next build` ✓.

---

## 1. Goal

Replace the 4 empty placeholder cards on `/dashboard` with **honest, glanceable day + month analytics**, auto-refreshing every 10s. It's the manager/owner "how's the shift / month going" overview (staff have their own POS/KDS/waiter screens).

---

## 2. Agent consensus (buyer + staff)

**Universal (6/6 owners):** Sales today, Order/transaction count, and **AOV (average ticket)** are the hero numbers. **Cash-vs-digital** that reconciles to total sales is the trust anchor (4/6, and its absence breaks trust).

**Kill "Covers" (0/6 accept a proxy).** We don't track pax, so a guessed covers number is "a lie I'll get asked about." Replace with **Open orders / tables now** (real, live, actionable) — or AOV.

**Split "Now" vs "Glance" (staff, emphatic):**
- **Now (act on, live):** open orders/tables with **aging** (oldest table's minutes, colour by age), low-stock/86 count, void spike. "Only the things I must act on should change appearance."
- **Today/Month (glance, quiet):** sales, orders, AOV, payment mix, trend — update silently every 10s, **no flashing/animation** (Sofia + Rajesh explicit).

**Not hero cards, but must exist (drill-down / muted):** tax/GST, discounts, comps, **voids** — 0/6 want them as hero cards, but 3/6 **distrust you if they're absent entirely** ("hiding my shrinkage").

**MTD:** month sales + month orders + AOV + a **daily sales trend** line (context, "nobody wants to stare at it"). vs-yesterday (sales) and vs-last-month deltas are wanted; formal targets are not.

**Deferred (out of v1 scope):** per-outlet grid (Priya), per-brand/channel (Marcus), true pax-based covers (Sofia), comps/voids **by employee** (Linda) — all real asks, but v1 is single-outlet.

---

## 3. Proposed layout (single outlet, v1)

**① "Now" strip (live, act-on):**
- Keep the existing **low-stock banner**.
- **Open now** card: open orders count · **₹ open value** · **oldest age** (green <30m / amber 30–45m / red 45m+).
- **Occupancy**: occupied / total tables (honest — "N seated", never "covers").

**② Today (hero cards, live, quiet):**
1. **Sales today** — gross, + small **vs-yesterday** delta.
2. **Orders today** — count, + **AOV** in the footer.
3. **Open now** — open orders count + ₹ open value *(this is the card that replaces "Covers")*.
4. **Cash vs Digital** — Cash / UPI / Card / Other, **sums to today's sales** (trust anchor).

**③ This month (MTD):**
5. **Month sales** — gross MTD, + vs-last-month delta.
6. **Month orders** — count MTD, + AOV MTD.
7. **Daily sales trend** — bar/line chart (recharts) for the month.

**④ Detail (muted, present for trust — not hero):**
- **Top items today** (top 5 by qty, from settled line snapshots).
- A quiet row: **tax ₹ · discounts ₹ · voids N** today (+ order-type split dine-in/takeaway/delivery).

---

## 4. Data + layers (bottom-up, TDD)

**Repository** (`order.repository.ts`):
- Reuse `findSettledOrdersSince` (month), `findOrdersByRestaurant(["OPEN"])`, `countVoidedSince`.
- Add `aggregateSettledBetween(restaurantId, from, to)` → `{ sum, count }` (Prisma `aggregate`) for the **last-month** delta (cheap — no row fetch).

**Service** (`dashboard.service.ts`, +spec):
- `getDashboard(restaurantId)` → `DashboardDTO`. Fetches **month settled orders once** (with items+payments) + open orders + tables + today voids + last-month aggregate, then derives everything in-memory:
  - today / yesterday (filter month set by `settledAt`), MTD, daily **trend**, **top items** today, **payment mix** today, **AOV**, tax/discount, order-type split.
  - open value via the pure `computeBill` on each open order; oldest age from `createdAt`; occupancy from open orders with a `tableId`.
- Pure helpers (day-bucketing, top-items aggregation, AOV, delta%) extracted + unit-tested.

**Types** (`types/dashboard.ts`): `DashboardDTO` + sub-DTOs.

**UI**:
- `dashboard/page.tsx` (RSC) fetches `getDashboard` + `getLowStockCount`, renders sections.
- Replace `section-cards.tsx` with real cards; add `components/dashboard/*` (metric cards, open-now, occupancy, sales-trend chart, top-items).
- `components/dashboard/auto-refresh.tsx` — a tiny `"use client"` that calls `router.refresh()` every 10s (same pattern as KDS/manager). Numbers update in place, **no animation**.

---

## 5. Auto-refresh

Whole page refreshes every 10s via a client `AutoRefresh` (router.refresh re-runs the RSC). Simple, matches the ask. **Note:** the month query runs each 10s — fine for single-outlet v1; a later optimization can poll only the live parts and refresh MTD less often.

---

## 6. Testing

- `dashboard.service.spec.ts` (mock repo): today/yesterday/MTD splits, AOV, payment mix sums to sales, trend bucketing, top items, open-now value/age, occupancy, deltas.
- `order.repository.spec.ts`: `aggregateSettledBetween`.
- Full suite + tsc + eslint + `next build` green (currently 478 passing).

---

## 7. Decisions to confirm

1. **Covers replacement:** the 3rd hero card → **"Open now" (open orders + ₹ open value)** *(agents' pick)* — or **AOV** / **Occupied tables**?
2. **Trust/detail row:** show a **muted tax · discounts · voids** row + order-type split on the home screen (present but not hero), or omit from home entirely?
3. **Comparisons:** show **vs-yesterday** (today's sales) and **vs-last-month** (MTD sales) deltas? (Recommended: yes.)
4. **Trend chart:** **daily sales bar chart** for the month (recommended) vs a compact sparkline?
5. **Refresh:** whole-page every 10s, numbers updating **quietly (no flashing)** — confirm that's the desired behaviour?

No code until these are settled.
