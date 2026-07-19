# Plan: Customer self-ordering — `/order/[username]?table=[tableCuid]`

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen operators) agents. Status: **SHIPPED 2026-07-19** — decisions locked (§9), built bottom-up TDD. Suite 449 green · tsc/eslint clean · `next build` ✓ (route `/order/[username]`).

---

## 1. What you asked for

A public link `/order/<restaurant-username>?table=<tableCuid>` where a seated guest can:
1. See the restaurant's live menu (same availability rules as POS/waiter).
2. Add items to a cart with variants/modifiers/notes — exactly like the waiter/POS builder.
3. **Before confirming, enter their phone number and verify it (OTP)**, then place the order.

`elitale` in your example = a restaurant `username` (`Restaurant.username`, already used by `/u/[username]`). `table` = a `DiningTable.id` (cuid).

---

## 2. Agent verdicts (condensed)

Both agents say the *core idea is sound for casual/QSR/cafe* — but flagged three things that turn it from "time-saver" into "kitchen chaos" if shipped naively. These are **not** optional polish; they're the difference between owners trusting it or disabling it.

**buyer (owners) — top risks**
- A public endpoint that writes **straight to the kitchen** = a stranger firing phantom tickets. Food cost is the #1 leak owners fear.
- **OTP does not stop a real person** placing a real prank/mistaken order — it only stops bots. The real gate is **a human accepting the ticket**.
- QR/self orders **must attach to the table's single open bill**, not spawn a competing ticket → reconciliation nightmare at settlement.
- Off by default; casual/QSR love it, fine-dining/bar want it off or food-only.

**staff (floor/kitchen) — top risks**
- Silent auto-fire breaks **coursing/timing** and floods the expo. Want **one-tap Accept/Reject** on a pending lane (waiter + KDS).
- **Raw table id is untrustworthy** (guest moves tables, QR photographed, re-scanned next day). Bind to a **live session** and let staff **reassign table on accept**.
- **Idempotent submit** (double-tap on bad wifi) + show the table's existing order context so staff don't double-fire.
- Void/cancel of a self-order **must reverse recipe stock depletion** (already true in our `order.service`).

**The tension with your spec:** you asked for *mandatory phone verify before ordering*. The agents' point is that verify is a **weak** gate for dine-in (the guest is sitting right there) and its real value is (a) reaching the guest and (b) marketing consent — while the **staff-accept step** is the strong gate. **You chose direct-to-kitchen (no gate)** — that owner override is respected; see the accepted-risk note in §3 and the compensating controls in §7.

---

## 3. v1 flow (decisions locked — see §9)

```
Guest opens /order/<username>?table=<cuid>   (dine-in only)
   → [public] load restaurant by username + validate table + selfOrderEnabled
   → browse full menu (getMenu) → build cart (POS/waiter parity)
   → tap "Place order"
   → if not already verified this table session: enter phone → SMS OTP → verify
   → order fires straight to the kitchen (no staff-accept gate):
        • table has an OPEN order → append items + fire (add-on batch)
        • table has none          → auto-create a new OPEN dine-in order + fire
   → lines tagged source = SELF_ORDER (LOUD badge on KDS/waiter/manager)
   → guest sees "Order placed ✓"
```

Phone verification is **once per table session** (short-lived signed `restro_guest` cookie scoped to restaurant + table), so adding "one more coffee" in the same seating doesn't re-prompt.

> **Risk accepted (owner override):** you chose direct-to-kitchen over the staff-accept gate both agents strongly recommended. Compensating controls we keep: mandatory OTP + signed guest token, idempotent submit, per-request qty caps, and the SELF-ORDER badge so the kitchen can eyeball origin. The **staff-accept gate stays documented as the v1.1 upgrade** if phantom/prank tickets become a problem.

---

## 4. Technical grounding (what we reuse vs. build)

**Reuse as-is**
- `getMenu(restaurantId)` → `MenuDTO` with computed availability (public-safe already).
- Cart line schema `cartLineSchema` + the waiter `OrderBuilder` / `ItemConfigDialog` / `useOrderCart` / client-side `computeBill`.
- `resolveTableForOrder(restaurantId, tableId)` → authoritative label + ownership check.
- `findRestaurantByUsername(username)`.
- `order.service.createOrder` / `addItems` / `fireOrder`. `OrderContext.userId` is already `string | null` and `staffId` optional → a guest actor (`userId: null, staffId: null`) flows through.
- OTP primitives: `OtpChallenge` model, `lib/otp.ts` (`generateOtpCode`, `hashOtpCode`), `lib/twilio.ts` (`sendSms`). `jose` session pattern from `lib/staff-session.ts`.

**Key gap to build (important)**
- `auth.service.requestOtp/verifyOtp` are **gated to registered managers** (`findEligibleUser` throws `OTP_USER_NOT_FOUND`). Guests have no `User` row. So we need a **guest OTP service** that reuses the `OtpChallenge` table + `lib/otp` + `sendSms` but **creates/verifies without any user lookup**. No schema change needed for OTP itself.
- **Proxy:** `/order/**` is currently treated as private → redirects to `/login`. Must be made public (like `/u/[username]/login`).
- **Verified-phone binding:** after OTP verify, issue a short-lived signed **guest token** (jose, scoped to `restaurantId + tableId + phone`, ~3h) as an httpOnly cookie. The submit action requires + verifies it, so a client can't submit with a fabricated "verified" phone. Reuses the `lib/staff-session.ts` approach; no DB session table in v1 (KISS).

---

## 5. Schema changes (additive, minimal)

**New enum**
- `OrderSource { STAFF, SELF_ORDER }`

**OrderItem attribution** (per-line so appended guest items to a waiter's order are still badged)
- `OrderItem.source OrderSource @default(STAFF)`

**Restaurant (self-order config)**
- `selfOrderEnabled Boolean @default(false)` — off by default (owner ask); owner-toggled in Settings.

No `GuestOrderRequest`, no `GuestOrderStatus`, no `selfOrderRequireAccept` — dropped because you chose direct-to-kitchen. Guest phone is snapshotted onto the order's existing `customerPhone`. Migration is **additive only** (project rule — no resets).

---

## 6. Layer-by-layer build (bottom-up, TDD — `.spec.ts` first)

1. **Schema + migration**: `OrderSource` enum, `OrderItem.source`, `Restaurant.selfOrderEnabled`; additive migration + `db:generate`.
2. **Validators** (`lib/validators/guest-order.ts`): `guestRequestOtpSchema` (phone), `guestVerifyOtpSchema` (phone + 6-digit), `guestSubmitOrderSchema` (username + tableId + reuses `cartLineSchema` + idempotencyKey + optional note). Zod, composed from `shared.ts`.
3. **Guest OTP service** (`services/guest-otp.service.ts`): `requestGuestOtp(phone)` (30s resend limit via `countRecentChallenges`) + `verifyGuestOtp(phone, code)` (5-attempt cap, 5-min TTL) — **no user row**. Specs cover expiry/attempts/rate-limit.
4. **Guest session** (`lib/guest-session.ts`): jose token `restro_guest` scoped to `{restaurantId, tableId, phone}`, ~3h TTL, httpOnly. `createGuestSession` / `getGuestSessionOrNull` + spec.
5. **Order service source threading**: extend `OrderContext` with `source?: OrderSource` (default `STAFF`); `snapshotLines` stamps each line's `source`; repo `OrderLineWriteData` gains `source`. Existing waiter/POS callers unchanged (default). Update specs.
6. **Guest order service** (`services/guest-order.service.ts`): `getGuestOrderContext(username, tableId)` (validate restaurant + table + `selfOrderEnabled`), `placeGuestOrder(session, input)` → find table's OPEN order → append + fire **or** auto-create OPEN dine-in order → `source: SELF_ORDER`. Specs: happy path (create + append), wrong/foreign table, disabled, idempotency.
7. **Actions** (`actions/guest-order.actions.ts`, public via `withValidation`): `guestRequestOtpAction`, `guestVerifyOtpAction` (sets `restro_guest` cookie), `guestPlaceOrderAction` (requires + verifies guest cookie, enforces cookie's table === submitted table). Specs for validation + missing/invalid cookie.
8. **Proxy**: make `/order/**` public (alongside `/u/[username]/login`).
9. **UI**: `src/app/order/[username]/page.tsx` (public RSC — loads restaurant/menu/table, guards disabled/invalid table) → client `components/guest-order/*` (menu browser + cart reusing POS pieces + `ItemConfigDialog`, phone+OTP sheet, confirmation state).
10. **SELF-ORDER badge**: surface line `source` in the kitchen ticket DTO + `KitchenStatusBadge`/board rows; manager orders board; waiter home. Reuse a small shared badge.
11. **Settings toggle**: `selfOrderEnabled` switch in the service-options settings card.

---

## 7. Anti-abuse (v1, cheap)

- Mandatory OTP verify → signed guest token required to submit.
- `idempotencyKey` per submission (kills double-tap dupes).
- OTP resend rate-limit (existing 30s window) + 5-attempt cap + 5-min TTL.
- Per-request line/qty caps (reuse `cartLineSchema` bounds).
- Guest token scoped to `tableId` → a photographed QR for a different table can't submit against this one; the action re-checks cookie table === submitted table.
- `selfOrderEnabled` off by default → no restaurant is live until the owner opts in.

---

## 8. Test + rollout

- Full Vitest suite green before done (currently ~408 passing). New specs co-located per layer.
- Regression: waiter add-items, kitchen ticket lifecycle, and table settlement must be unchanged; guest lines appear as a normal fired batch, badged SELF-ORDER.
- Ship **off by default**; enable for one outlet; watch dupe rate, OTP failure rate, and mistaken-order voids (the risk from skipping the staff gate).

---

## 9. Decisions (locked 2026-07-19)

1. **Kitchen gate:** → **Direct-to-kitchen on verify (no staff-accept gate).** *(Owner override of both agents' recommendation — risk accepted, see §3.)*
2. **On submit with no open table order:** → **auto-create a new OPEN dine-in order** for the table; if one exists, append + fire.
3. **Order types:** → **dine-in only** in v1.
4. **OTP cadence:** → **once per table session** (signed `restro_guest` cookie).
5. **Menu scope:** → **full menu** in v1 (no per-category exclusion).
6. **Visibility:** → **SELF-ORDER badge on KDS/waiter/manager boards** (not printed on KOT/invoice in v1).

Build proceeds bottom-up per §6.
