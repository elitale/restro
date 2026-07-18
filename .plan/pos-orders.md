# POS + Orders (v1)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> Builds on the existing **Menu** (items, variants, modifiers, GST model). Layered (UI → Actions → Services → Repositories → DB), TDD-first.
> **Status: SHIPPED (2026-07-18).** POS + Orders + billing/settlement + KOT/invoice live. 193 tests pass. See `MEMORY.md` → "POS & Orders" for the as-built summary.

---

## 0. TL;DR — what the agents changed

Both agents were emphatic: **don't boil the ocean.** "Dine-in tabs + takeaway + delivery + billing + payments + KDS in one v1" ships six half-baked things and gets uninstalled in a Friday rush.

- **Buyer:** nail **counter/takeaway billing** end-to-end with **provably correct GST** and a proper receipt — that alone is a sellable product and the highest willingness-to-pay item. Dine-in tabs = the very next thing; delivery-by-manual-entry is a trap (needs aggregator API — v2).
- **Staff:** a one-shot cart is **not a dine-in POS** — dine-in needs an **open tab per table + add-across-rounds + fire-only-new-lines**. Two things they refuse to let us cut: a **free-text line note** ("no onion", "peanut allergy") and **local-first + reliable KOT print**.
- **Both:** **KOT ≠ Bill** (kitchen ticket has no prices; the tax invoice is a separate, sequentially-numbered document). **86 must block the cart live.** Every void/reopen needs **reason + who**. Bake **`idempotencyKey` + sequence numbers + (future) `outletId`** into the order model *now* so offline & multi-outlet aren't a rewrite later.

**Honest scoping call (this codebase is a connected web app):** true **offline-first (PWA/local DB)** and **native LAN/ESC-POS thermal printing** are their own infrastructure projects. v1 ships **connected** with **browser-dialog printing** of KOT/Invoice HTML (works with a default thermal printer). We design the data model so offline + native printing slot in later without a rewrite, and we say so plainly rather than faking it.

**Recommended v1:** counter/takeaway billing done right **+ a basic dine-in tab** (open order, add rounds, fire-new) because the tab-ready model supports it cheaply. Table map / merge / split / KDS / discounts / day-close-Z-report / aggregators are **deferred** (see §10).

---

## 1. Recommended decisions

- **Scope:** counter/**takeaway** fully + **basic dine-in tab** (open order + add rounds + fire-only-new). **Delivery** = "takeaway with a customer name/phone/address" (manual, no aggregator).
- **Order model is tab-ready:** an order stays **OPEN** and mutable until settled; **per-line fire state** (`UNSENT`/`FIRED`/`SERVED`/`VOID`) so adding a round fires only new lines. `tableLabel` is free text in v1 (no Table/floor-map model yet).
- **Snapshots:** every order line snapshots name/variant/unit price/tax rate/modifiers at order time, so later menu edits never change a historical bill.
- **KOT ≠ Invoice:** KOT = kitchen ticket (items, variant, modifiers, **note**, table/round — **no prices**), printed on fire. **Tax Invoice** = priced, GST-itemized (CGST/SGST split), **sequential gap-free invoice number**, GSTIN, round-off — printed at settle. Reprints marked **DUPLICATE**.
- **GST:** reuse the existing `resolveItemTax` logic; a pure `computeBill()` produces line taxes + totals + round-off from the snapshots. Service charge is **not** in the GST base (India). Tax-inclusive handled.
- **Payments:** **cash** (tendered/change) + **UPI** (mark-paid + optional ref) + **card** (mark only, no PSP integration). **Multi-tender in v1** — settle records one or more payments (cash+UPI split supported).
- **Discounts / comps (in v1):** order-level discount (**percent or flat**, with reason + acting user) that reduces the **GST taxable base** correctly; per-line **comp** (free item, reason) excluded from the charge and tracked separately.
- **Numbering:** `orderNumber` at creation (may have gaps from voids); `invoiceNumber` assigned **at settle** from an atomic per-restaurant counter (gap-free for tax invoices). `idempotencyKey` (unique) on every order to make "Send" safe to retry.
- **Print:** v1 = printable KOT / Invoice HTML routes + `window.print()`. Native/LAN ESC-POS thermal = later.
- **Access:** manager-scoped (`getManagerContextOrNull` + `withManagerValidation`), single restaurant. Every place/void/settle stamped with the acting user.
- **Availability:** POS reads live item availability (existing `isItemAvailable`); an item marked unavailable is blocked in the cart before fire.

---

## 2. Data model (Prisma — additive migration `add_orders`)

```prisma
enum OrderType        { DINE_IN TAKEAWAY DELIVERY }
enum OrderStatus      { OPEN COMPLETED VOID }
enum OrderLineState   { UNSENT FIRED SERVED VOID }
enum PaymentMode      { CASH UPI CARD OTHER }
enum DiscountType     { NONE PERCENT FLAT }

// --- add to Restaurant ---
// nextInvoiceSeq Int  @default(1)   // atomic counter for gap-free tax invoice numbers
// orders         Order[]

model Order {
  id             String      @id @default(cuid())
  restaurantId   String
  orderNumber    Int                                   // per-restaurant, at creation
  invoiceNumber  Int?                                  // assigned at settle (gap-free)
  idempotencyKey String      @unique                   // safe retry of "Send"
  orderType      OrderType   @default(TAKEAWAY)
  status         OrderStatus @default(OPEN)
  tableLabel     String?                               // free text in v1 (no floor map yet)
  customerName   String?
  customerPhone  String?
  note           String?

  // money snapshot, computed at settle
  subtotal       Decimal     @default(0) @db.Decimal(10, 2)
  taxTotal       Decimal     @default(0) @db.Decimal(10, 2)
  discountType   DiscountType @default(NONE)
  discountValue  Decimal     @default(0) @db.Decimal(10, 2)   // percent or flat rupees
  discountReason String?
  discountTotal  Decimal     @default(0) @db.Decimal(10, 2)
  compTotal      Decimal     @default(0) @db.Decimal(10, 2)
  roundOff       Decimal     @default(0) @db.Decimal(10, 2)
  grandTotal     Decimal     @default(0) @db.Decimal(10, 2)

  placedById     String
  voidedById     String?
  voidReason     String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  settledAt      DateTime?
  deletedAt      DateTime?

  restaurant Restaurant  @relation(fields: [restaurantId], references: [id])
  items      OrderItem[]
  payments   Payment[]

  @@unique([restaurantId, orderNumber])
  @@index([restaurantId, status])
}

model OrderItem {
  id            String        @id @default(cuid())
  orderId       String
  menuItemId    String?                               // snapshot reference (nullable)
  variantId     String?
  name          String                                // snapshot
  variantName   String?
  unitPrice     Decimal       @db.Decimal(10, 2)      // snapshot (base + variant)
  quantity      Int           @default(1)
  lineNote      String?                               // free text — must-have per staff
  taxRate       Decimal       @default(0) @db.Decimal(5, 2)   // snapshot
  taxKind       String        @default("NONE")        // NONE | SERVICE | GOODS
  taxInclusive  Boolean       @default(false)
  state         OrderLineState @default(UNSENT)
  isComp        Boolean       @default(false)         // free/complimentary line
  compReason    String?
  firedAt       DateTime?
  voidReason    String?
  sortOrder     Int           @default(0)
  createdAt     DateTime      @default(now())

  order     Order              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  modifiers OrderItemModifier[]

  @@index([orderId])
}

model OrderItemModifier {
  id          String  @id @default(cuid())
  orderItemId String
  modifierId  String?                                 // snapshot reference
  name        String                                  // snapshot
  priceDelta  Decimal @default(0) @db.Decimal(10, 2)  // snapshot

  orderItem OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  @@index([orderItemId])
}

model Payment {
  id           String      @id @default(cuid())
  orderId      String
  mode         PaymentMode
  amount       Decimal     @db.Decimal(10, 2)
  tendered     Decimal?    @db.Decimal(10, 2)         // cash: amount given
  reference    String?                                // UPI/card ref
  receivedById String
  createdAt    DateTime    @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}
```

---

## 3. Billing / GST (pure, exhaustively tested)

`computeBill(lines)` → `{ lines:[{ taxable, cgst, sgst, tax, total }], subtotal, taxTotal, roundOff, grandTotal }`
- Per line: `gross = (unitPrice + Σ modifier deltas) × qty`. If `taxInclusive` → back-out tax from gross; else tax = `gross × rate/100`. `cgst = sgst = tax/2`.
- `NONE` kind → zero tax. **Comp** lines charge ₹0 (excluded from taxable, summed into `compTotal`). **Discount** (percent or flat) reduces each non-comp line's **taxable base proportionally** *before* tax, so CGST/SGST compute on the discounted base (India rule). `roundOff` = nearest ₹1 on grand total; `grandTotal` = rounded.
- Reuses the tax already resolved on the menu item (`resolveItemTax`) at add-to-cart time and **snapshots** it onto the line. This is the buyer's trust anchor — unit-tested across SERVICE / GOODS / NONE / composition / inclusive / **discount / comp / round-off**.

---

## 4. Order lifecycle

```
cart (client) ──Send──▶ OPEN ──add round──▶ (fire only UNSENT lines) ──▶ … ──Settle──▶ COMPLETED
                          │                                                   (assign invoiceNumber, record Payment(s))
                          └── Void (reason + user) ──▶ VOID        line: UNSENT→FIRED→SERVED, or VOID (reason)
```
- **Takeaway** collapses place→settle almost together; **dine-in tab** stays OPEN across rounds; **add-to-order** creates new `UNSENT` lines and fires only those (new KOT batch).
- Void after fire → line `VOID` + reason + kitchen amendment note (v1: shown on a reprinted KOT slice). Reopen-after-settle = **v1.1** (needs stronger audit).

---

## 5. KOT & print

- **KOT view** (`/dashboard/orders/[id]/kot?batch=n`, printable): table/type, order #, round/batch, each line **bold** with variant + modifiers + **note** (allergy/no-onion highlighted), **no prices**. Printed on fire via `window.print()`.
- **Invoice view** (`/dashboard/orders/[id]/invoice`, printable): restaurant name + **GSTIN**, sequential **invoice #**, datetime, itemized taxable + CGST/SGST, round-off, total, payment mode(s); reprint stamped **DUPLICATE**.
- Both are plain print-friendly HTML (58/80mm-friendly CSS). Native ESC-POS/LAN printing = deferred.

---

## 6. Offline & printing — honest scoping

The agents' #1 requirement is **offline-first + always-prints KOT**. That is a **separate infrastructure project** (service worker + IndexedDB queue + local print bridge) and is **out of v1**. We de-risk it now by baking in:
- **`idempotencyKey`** on every order (retry-safe "Send").
- **Atomic sequence counters** (offline can later mint provisional numbers reconciled on sync).
- **Client-side deterministic `computeBill`** (no server needed to total a cart).
v1 is a **connected** POS with browser printing. This is stated plainly (per the buyer's "connected counter billing beta") rather than faked.

---

## 7. Layered build order (bottom-up, TDD — each layer ships `*.spec.ts`)

1. **Schema + migration** `add_orders` (+ Restaurant counter/relation), `prisma generate`.
2. **Validators** — `lib/validators/order.ts` (cart line, create-order, add-items, void, settle/payment).
3. **Repositories** (+specs): `order.repository` (create with nested items+modifiers, find open/by-id/list, add items, update line state, void, settle+assign invoice via atomic counter), `payment.repository`.
4. **Services** (+specs): pure `computeBill` (heavy tests) + `resolveLineTax` snapshotting; `order.service` (createOrder, addItems, fireItems, voidLine/Order, listOrders→DTO, getOrder→DTO, ownership); `settlement.service` (settle: compute → assign invoice → record payments → COMPLETE); `pos-menu.service` (menu for POS: available items only, grouped).
5. **Actions** (+specs): `order.actions.ts` — createOrderAction, addItemsAction, fireAction, voidLineAction, voidOrderAction, settleAction, (all `withManagerValidation`, idempotency-aware).
6. **UI:**
   - `/dashboard/pos` — category + **Favorites** grid, item→variant→modifier **chips** (required auto-defaulted)→qty stepper→**line note**→cart; order type + table label; live availability block; **Send**.
   - `/dashboard/orders` — live list by status; order detail drawer; add-round, mark served, **void (reason)**, **Settle** (payment: cash tendered/change / UPI / card), reprint KOT/Invoice.
   - Printable **KOT** + **Invoice** routes.
   - shadcn (already have dialog/table/card/badge/tabs/sonner/select/switch/textarea); may add `radio-group` or `tabs` for payment.

---

## 8. Use cases → phase mapping

### Owner / buyer
| Use case | Verdict | Phase |
|---|---|---|
| Fast item→variant→modifier→qty→cart off the menu | Must | **v1** |
| Correct GST bill (per-line rate, inclusive, round-off, CGST/SGST) | Must (differentiator) | **v1** |
| KOT print separate from Tax Invoice print | Must | **v1** |
| Cash + UPI (+ card mark) payment, tendered/change | Must | **v1** |
| Sequential gap-free invoice numbering | Must (compliance) | **v1** |
| Void/cancel with reason + user (anti-skimming) | Must | **v1** |
| Basic "today's sales" summary (by mode, voids, tax) | Should | **v1 (light)** |
| Full day-close / Z-report + cash reconciliation | Should | **v1.1** |
| Dine-in running tabs / table map | Rajesh's 70% | **v1 tab (basic) / map v1.1** |
| Split bill, discounts/comps, card PSP, khata | Should | **v1.1** |
| Offline billing + native thermal print | Highest WTP | **Deferred (infra)** |
| Aggregator (Swiggy/Zomato) ingestion | Must for cloud kitchens | **v2** |
| Multi-outlet fleet roll-up | Priya | **v2 (model reserves `outletId`)** |

### Floor / staff
| Use case | Verdict | Phase |
|---|---|---|
| **Free-text line note** (no onion / allergy) | Must (refuse to cut) | **v1** |
| Order type at start; qty stepper; modifier chips; required auto-default | Must | **v1** |
| Open tab per table + add across rounds + **fire-only-new** | Must (dine-in) | **v1 (basic tab)** |
| Live 86 blocks the item in the cart | Must | **v1** |
| KOT with variant+modifiers+note bold, batch marked | Must | **v1** |
| Orders page: live status list; **move line/round to another table ≤2 taps** | Must | **v1 list / move-table v1.1** |
| Settle cash/UPI/card + **one-tap reprint** | Must | **v1** |
| Manager-approved void-after-fire / reopen-settled | Must | **v1 void / reopen v1.1** |
| Local-first + local KOT print | Must (highest risk) | **Deferred (infra)** |
| Favorites/top-20 grid, repeat-last-round | Should | **v1 favorites / repeat v1.1** |
| Split bill/tender, coursing (hold/fire), transfer/merge | Should | **v1.1** |
| Digital KDS bump screen | Later | **v2 (paper KOT covers v1)** |

---

## 9. Decisions (locked)

1. **Scope** — takeaway/counter **+ basic dine-in tab** (open order, add rounds, fire-only-new). ✅
2. **Print** — browser `window.print()` on print-friendly KOT/Invoice HTML. ✅
3. **Payments** — cash + UPI + card(mark), **multi-tender in v1** (settle records ≥1 payment; cash+UPI split). ✅
4. **Delivery** — manual **"takeaway + customer name/phone/address"** (no aggregator). ✅
5. **Day-close** — light **"today's sales"** summary in v1; full Z-report/cash-reconciliation v1.1. ✅
6. **Discounts/comps** — **in v1**: order-level discount (% or flat) + per-line comp, both with reason + acting user, GST base adjusted correctly. ✅
7. **Routes** — POS `/dashboard/pos`, Orders `/dashboard/orders`; sidebar "Orders" wired + a "POS" entry. ✅

## 10. Deliberately deferred (with rationale)

- **Offline-first / PWA + native LAN ESC-POS printing** — separate infra; model is made ready (idempotency, sequences, client-side totals). *The agents' top concern — called out, not hidden.*
- **Dine-in floor map, merge/split/transfer tables, split-by-seat, coursing beyond hold/fire** — need a Table/seat model; v1 basic tab uses a free-text table label.
- **Full day-close Z-report + cash reconciliation, discounts/comps engine, split bill/tender UI, reopen-settled** — real, but don't block a working v1.
- **Digital KDS bump screen** — paper KOT covers the rush and never freezes (staff explicitly prefer this for v1).
- **Aggregator ingestion, multi-outlet fleet, loyalty** — v2. Model reserves an `outletId` seam.

## 11. Verification

- TDD: `.spec.ts` first for every validator/repo/service/action; **exhaustive `computeBill` tests** (SERVICE/GOODS/NONE/composition/inclusive/round-off/modifiers) and settlement invoice-number sequencing.
- `npx tsc --noEmit && npx eslint src && npx vitest run` — zero failures.
- Manual: build a cart → Send (KOT prints, lines FIRED) → add a round (only new lines fire) → Settle cash (change shown, invoice # assigned, COMPLETED) → reprint invoice (DUPLICATE).
