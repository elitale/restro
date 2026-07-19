# Plan: Self-order session persistence + new-order voice alerts

> Plan-first. Status: **SHIPPED 2026-07-20** — decisions locked (§6), built bottom-up TDD. Suite 466 green · tsc/eslint clean · `next build` ✓.

---

## 1. Goals

1. **Guest self-order session persists in `localStorage`** so a customer who closes/refreshes the page (or comes back to add another item at the same table) doesn't lose their place.
2. **Every new customer self-order triggers a TTS voice alert** on:
   - the **KOT / KDS** (kitchen), and
   - the **manager `/dashboard/orders`** board,
   both auto-refreshing every ~10s, so staff/manager hear "there's a new order".

---

## 2. What already exists (reuse)

- **Verification already persists** server-side: after OTP, the `restro_guest` cookie (jose, 3h, scoped to `restaurantId+tableId+phone`) is set; the page reads it and passes `initiallyVerified`. So "add another item" already skips OTP within 3h. **What's missing is the client-side cart draft + a client-visible session marker.**
- **Announcer stack:** `useAnnouncer()` (Hindi speech + beep/boop fallback, on-by-default, gesture-primed, persisted toggle), shared `SoundToggle`, and phrases in `lib/announce.ts` (`newOrderPhrase`, `orderReadyPhrase`, `newIds`).
- **KDS** (`KitchenDisplay`) already polls every 10s (`router.refresh()`) and announces **new tickets** via `newOrderPhrase` + `newIds` on `orderId`. Guest orders that create a new ticket already speak. **Gap:** a guest *adding items to an existing* open table order reuses the same `orderId`, so it is **not** detected as "new" → no alert today.
- **Manager `OrdersBoard`** is a client component but has **no polling and no announcer** today.

---

## 3. Feature A — Guest session persistence (localStorage)

**Where:** `components/guest-order/guest-order-page.tsx` (+ small helper).

**Persist, keyed by `restro.guestcart.<username>.<tableId>`:**
- the **in-progress cart draft** (the `CartLine[]`), and
- a lightweight **session marker** `{ verified: boolean, phone?: string, updatedAt }` so the UI can show "welcome back / add more" and pre-fill the phone (client can't read the httpOnly cookie).

**Behaviour:**
- On mount (client-only, after hydration — mirror the announcer's `requestAnimationFrame(() => setState(…))` pattern to satisfy the enforced `react-hooks/set-state-in-effect` rule), **restore** the saved cart for this table.
- On every cart change, **write** the draft to localStorage (writing in an effect is fine — it's not `setState`).
- On **successful order**, **clear** the saved cart draft (keep the session marker so "add more" stays smooth).
- **Expire** saved data after the same ~3h window as the cookie (stale entries ignored + pruned).
- Scope strictly per `username+tableId` so a different table/QR never restores the wrong cart.

**Note:** the actual verified gate stays server-authoritative (cookie + `guestPlaceOrderAction` re-check). localStorage is convenience only — never the source of truth for "verified".

---

## 4. Feature B — New-order voice alerts + 10s refresh

### 4a. Manager `/dashboard/orders` (new work)
- Make `OrdersBoard` **poll every 10s** via `router.refresh()` in a `useEffect` interval (same as KDS/waiter).
- Add `useAnnouncer()` + a `SoundToggle` in the board header (**default ON**).
- **Announce every new order** (any source): brand-new order id → alert. When the new order has self-order lines, use the **distinct self-order phrase**; otherwise the generic new-order phrase.
- **Guest add-ons:** also alert when an existing order's **self-order** line count increases (guest added items). Staff add-ons stay silent (the manager/waiter made them).
- Phrase: new `selfOrderAlertPhrase()` in `lib/announce.ts`, e.g. **"Naya self-order, Table 5"** (Hindi romanized, consistent with existing voice).

### 4b. KDS / KOT (mostly done — enhance)
- Already announces new tickets. Add a **distinct self-order phrase** so the kitchen hears it's a guest order (aligns with the existing SELF-ORDER badge), instead of the generic "Naya order".
- **Guest additions (see §6 Q2):** optionally also announce when a guest **adds a fired self-order batch to an existing** ticket (not just brand-new tickets). Requires tracking a per-order self-order-line signature (e.g. count) instead of just `orderId` presence.

### 4c. Shared detection helper
- Add a small pure helper in `lib/announce.ts` to detect "new self-order activity" (new order id **and/or** increased self-order line count per order), unit-tested, so both surfaces share one tested rule.

---

## 5. Layers & tests (TDD)

- **`lib/announce.ts`** (+ `.spec.ts`): `selfOrderAlertPhrase()`, and a `newSelfOrderSignatures()` / `changed()` pure helper for detection. Pure → easy unit tests.
- **`components/orders/orders-board.tsx`**: polling + announcer + toggle (client; manual/logic-light).
- **`components/kitchen/kitchen-display.tsx`**: swap to self-order-aware phrase; optional add-on detection.
- **`components/guest-order/guest-order-page.tsx`** (+ maybe `lib/guest-cart-storage.ts` pure read/write/expiry helper + `.spec.ts`): persistence.
- Full suite + `tsc` + `eslint` + `next build` green before done (currently 451 passing).

---

## 6. Decisions (locked 2026-07-20)

1. **Manager alert scope:** → **all new orders** (self-order ones get the distinct phrase; staff ones get the generic phrase).
2. **Guest additions:** → **yes** — alert on new orders **and** guest add-ons to an existing table order (via per-order self-order line-count increase). Staff add-ons stay silent.
3. **localStorage scope:** → **cart draft + verified marker** (no phone pre-fill).
4. **Clear/expire:** → clear the cart draft on a successful order; expire the whole entry after **~3h** (matches the session cookie).
5. **Voice:** → **Hindi romanized, distinct self-order phrase**; manager board sound **default ON** with a toggle.

Build proceeds bottom-up (§5).
