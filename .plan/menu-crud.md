# Menu Management (CRUD + photos + per-item tax + time-boxed 86)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> Follows the layered architecture (UI → Actions → Services → Repositories → DB), TDD-first.
> Honors the requested scope, with **two agent-driven corrections baked in** (GST model + safe 86).

---

## 0. TL;DR — what changed after agent review

The requested scope is buildable, but the agents flagged two things that are cheap to get right **now** and expensive to fix later:

1. **"Per-item GST on every item" is wrong for Indian restaurants.** Served food is a *restaurant service* taxed at a flat **5% at the outlet level** (SAC 996331), **not** a per-dish goods tax. A true per-item goods GST rate (12/18/28%) applies **only to packaged/retail goods** (sealed water, bottled drinks, boxed bakery). → We model **outlet-level service rate as the default**, with a **per-item override only for `PACKAGED_GOODS`**. **GST is fully optional** — a restaurant defaults to `UNREGISTERED` (no GST charged) until the owner configures it, since many small restaurants aren't GST-registered.
2. **The 86 (disable) flow is the only rush-critical part** and must carry a **reason + who/when audit** and must **not silently re-enable while still out of stock**. We build availability as a first-class, logged concept (not just a boolean on the edit form), even though the POS/KDS/aggregator surfaces that would consume it don't exist yet.

Everything the user explicitly asked for is in **v1**, **plus variants (half/full, S/M/L) and modifiers / add-ons** (pulled into v1 per decision). Channel-pricing / multi-outlet / combos / bulk-import / POS-KDS-aggregator surfaces remain **deferred** (schema left non-blocking).

---

## 1. Locked decisions

- **Ownership scope:** menu belongs to a **Restaurant** (no `Outlet` model exists yet). Schema is outlet-ready (FKs on `Restaurant`) but v1 is single-tier.
- **Access:** owner/manager only, gated by the existing `requireUserId()` + the item's `restaurantId` must belong to the current user's owned restaurant. (No POS/KDS/line-staff surfaces yet — so 86 is manager-driven in v1.)
- **Tax model (corrected + optional):** GST is opt-in — a Restaurant defaults to **`UNREGISTERED` (no GST)**. When registered `REGULAR`, outlet-level `serviceGstRate` (5, or 18 for hotel-tariff) drives **SERVED** items; **PACKAGED_GOODS** items may carry their own `goodsGstRate` + HSN. `COMPOSITION` ⇒ tax not separately charged, prices tax-inclusive, no GST line. Billing-authoritative metadata (billing engine is later; schema must already be correct).
- **Variants & modifiers (in v1):** items may have **variants** (Half/Full, S/M/L — each its own price/availability) and reusable **modifier groups** (add-ons like extra shot / oat milk with price deltas, min/max, required). Item `price` is the default/base; when variants exist they are the sellable units.
- **Availability / 86:** an item is *available* iff `isActive && !deletedAt && category.isActive && no open 86`. A "86" is a **row** (`MenuItemAvailability`) with `reason`, `note?`, `disabledBy`, `disabledAt`, `resumeAt?`, `reenabledAt?/By?` — this doubles as the audit log.
- **Time-boxed disable:** default **"until end of business day"**; also "for 2h / until date-time / until I turn it back on". `resumeAt` in the past ⇒ item computes as available again (implements "for a certain period"), **and** the Menu UI shows an "expiring / still off?" prompt so nothing silently returns (staff landmine). No cron needed in v1 (availability is computed at read time).
- **Photos:** stored in **Supabase Storage (S3-compatible)** — endpoint already in `.env`. 1..N images per item (cap **3** in v1), `isPrimary` flag, server-side upload + `sharp` resize to WebP (≤1600px) + thumbnail. Photos & descriptions are **optional** fields.
- **Icons:** lucide (project standard; avoid per-feature mixing).
- **Forms:** shadcn **primitives** (`Field`, `Input`, `Textarea`, `Select`, `Switch`, `Dialog`…) driven by the existing `useServerAction` + `withValidation` pattern — **not** react-hook-form (keep consistency with `onboard-restaurant-form`).
- **Toasts:** `sonner` (already installed) for create/update/86 success + errors.

---

## 2. Data model (Prisma — additive migration)

```prisma
enum GstRegistrationType { REGULAR COMPOSITION UNREGISTERED }
enum MenuItemType        { SERVED PACKAGED_GOODS }
enum DietaryType         { VEG NON_VEG EGG }
enum Disable86Reason     { OUT_OF_STOCK QUALITY PREP_TIME OTHER }

// --- add to existing Restaurant model (tax profile — GST is optional/opt-in) ---
// gstRegistrationType GstRegistrationType @default(UNREGISTERED)  // opt-in when they register
// serviceGstRate      Decimal?  @db.Decimal(5,2)                  // 5 (or 18 hotel≥₹7,500); null when unregistered
// pricesTaxInclusive  Boolean   @default(false)
// gstin               String?
// sacCode             String?   @default("996331")

model MenuCategory {
  id           String    @id @default(cuid())
  restaurantId String
  name         String
  description  String?
  sortOrder    Int       @default(0)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  items        MenuItem[]
  @@unique([restaurantId, name])
  @@index([restaurantId])
}

model MenuItem {
  id                String    @id @default(cuid())
  restaurantId      String
  categoryId        String
  name              String
  shortDescription  String?                       // menu-card line
  longDescription   String?                       // details
  itemType          MenuItemType @default(SERVED)
  dietaryType       DietaryType?                  // veg/non-veg/egg dot (India-expected)
  price             Decimal   @db.Decimal(10,2)
  priceTaxInclusive Boolean?                      // null = inherit Restaurant
  goodsGstRate      Decimal?  @db.Decimal(5,2)    // only when PACKAGED_GOODS
  hsnSacCode        String?
  sortOrder         Int       @default(0)
  isActive          Boolean   @default(true)      // owner master on/off
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
  restaurant        Restaurant   @relation(fields: [restaurantId], references: [id])
  category          MenuCategory @relation(fields: [categoryId], references: [id])
  images            MenuItemImage[]
  disables          MenuItemAvailability[]
  variants          MenuItemVariant[]
  modifierGroups    MenuItemModifierGroup[]
  @@index([restaurantId])
  @@index([categoryId])
}

model MenuItemImage {
  id         String   @id @default(cuid())
  menuItemId String
  url        String
  storageKey String
  isPrimary  Boolean  @default(false)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  @@index([menuItemId])
}

model MenuItemAvailability {          // one "86" event == one audit row
  id            String   @id @default(cuid())
  menuItemId    String
  reason        Disable86Reason
  note          String?
  disabledById  String
  disabledAt    DateTime @default(now())
  resumeAt      DateTime?             // null = manual re-enable; else auto-return
  reenabledAt   DateTime?
  reenabledById String?
  menuItem      MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  @@index([menuItemId])
}

model MenuItemVariant {
  id         String    @id @default(cuid())
  menuItemId String
  name       String                          // "Half", "Full", "S/M/L", "330ml"
  price      Decimal   @db.Decimal(10,2)
  sortOrder  Int       @default(0)
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  deletedAt  DateTime?
  menuItem   MenuItem  @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  @@index([menuItemId])
}

model ModifierGroup {                         // reusable across items ("Milk", "Add-ons")
  id           String    @id @default(cuid())
  restaurantId String
  name         String
  minSelect    Int       @default(0)
  maxSelect    Int       @default(1)
  isRequired   Boolean   @default(false)
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
  restaurant   Restaurant             @relation(fields: [restaurantId], references: [id])
  modifiers    Modifier[]
  items        MenuItemModifierGroup[]
  @@index([restaurantId])
}

model Modifier {
  id         String   @id @default(cuid())
  groupId    String
  name       String                          // "Oat milk", "Extra shot"
  priceDelta Decimal  @default(0) @db.Decimal(10,2)
  sortOrder  Int      @default(0)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  group      ModifierGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@index([groupId])
}

model MenuItemModifierGroup {                 // item <-> group join (reuse groups)
  menuItemId      String
  modifierGroupId String
  sortOrder       Int    @default(0)
  menuItem        MenuItem      @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)
  @@id([menuItemId, modifierGroupId])
  @@index([modifierGroupId])
}
```

`isAvailable(item, now)` (service-computed, never stored):
`item.isActive && item.deletedAt == null && item.category.isActive && !exists(open 86)` where an *open 86* = `reenabledAt == null && (resumeAt == null || resumeAt > now)`.

---

## 3. Tax resolution (pure service fn — the trust-critical bit)

`resolveItemTax(item, restaurant) -> { rate, code, kind, separatelyCharged, inclusive }`
- `restaurant.gstRegistrationType == UNREGISTERED` → `{ rate: 0, kind: "NONE", separatelyCharged: false }` (no GST at all)
- `PACKAGED_GOODS` + `goodsGstRate` set → `{ rate: goodsGstRate, code: hsnSacCode, kind: "GOODS" }`
- else `SERVED` → `{ rate: restaurant.serviceGstRate ?? 0, code: hsnSacCode ?? restaurant.sacCode, kind: "SERVICE" }`
- `restaurant.gstRegistrationType == COMPOSITION` → `separatelyCharged = false`, `inclusive = true`
- `inclusive = item.priceTaxInclusive ?? restaurant.pricesTaxInclusive`

Unit-tested exhaustively (this is where bad bills come from).

---

## 4. Image upload approach

- `lib/storage.ts` — thin wrapper over `@aws-sdk/client-s3` pointed at `SUPABASE_S3_ENDPOINT`. `putObject(key, body, contentType)` + `deleteObject(key)` + `publicUrl(key)`.
- Upload path: server action / route handler receives the file (FormData) → validate MIME (`image/jpeg|png|webp`) + size (≤5 MB) → `sharp` → WebP main (≤1600px) + thumb (≤400px) → upload both → insert `MenuItemImage` rows → return URLs.
- Delete: remove storage objects + row; block deleting the last primary if others exist (repoint primary).
- **v1 = server-side upload** (simple). Presigned direct-to-bucket upload = later optimization if large files bite the action body limit.

---

## 5. Layered build order (bottom-up, TDD — each layer ships with `*.spec.ts`)

1. **Schema + migration** (`add_menu`), `prisma generate`.
2. **Validators** — `lib/validators/menu.ts` (category, item, image, disable/86 schemas) composed from `shared.ts`.
3. **Repositories** (+specs, mock `@/lib/prisma`): `menu-category.repository`, `menu-item.repository` (list w/ images+category+variants+open-86, get, create/update/soft-delete, reorder), `menu-item-image.repository`, `menu-variant.repository`, `modifier-group.repository` (+ `Modifier`, item↔group join), `menu-availability.repository` (open 86, create/close).
4. **Services** (+specs, mock repos): `menu-category.service`, `menu-item.service` (CRUD + `resolveItemTax` + `isAvailable`), `menu-variant.service`, `modifier.service` (groups + modifiers + attach/detach, validate `minSelect ≤ maxSelect ≤ modifier count`), `menu-availability.service` (`disableItem`/`reenableItem`), `lib/storage.ts` (+spec).
5. **Actions** (+specs): `menu.actions.ts` — category CRUD, item CRUD (incl. variants + attached modifier groups), modifier-group CRUD, `uploadItemImageAction`, `deleteItemImageAction`, `disableItemAction`, `reenableItemAction` (all `withValidation`, ownership-checked).
6. **UI** (`/dashboard/menu`): items grouped by category (shadcn `Table`/`Card` + veg/non-veg dot `Badge` + availability `Badge`), item create/edit `Dialog` (Field/Input/Textarea/Select/Switch + **variant rows** + **modifier-group picker** + image dropzone), a **Modifier groups** manager, the **86 dialog** (reason + duration chips, default "until end of day"), and a lightweight **"86 board"**. Wire via `useServerAction`; `serializeForClient()` for Decimals/Dates.

**shadcn to add:** `textarea`, `switch`, `dialog` (rest already present: field, input, select, badge, table, card, dropdown-menu, sonner, tabs, tooltip, skeleton).
**deps to add:** `@aws-sdk/client-s3`, `sharp` (explicit; already allow-listed).

---

## 6. Use cases (from the agents) → phase mapping

### Owner/buyer (product)
| Use case | Verdict | Phase |
|---|---|---|
| Category + item CRUD (owner/manager) | Must | **v1** |
| Short + long description, photos, price | Requested | **v1** |
| **Correct tax**: outlet 5% service default + packaged-goods HSN override + composition | Must (correctness) | **v1** |
| Veg/non-veg/egg dietary dot | Should (India legal-expected, cheap) | **v1** |
| Time-boxed 86 with reason + audit | Must | **v1** |
| Variants/sizes (half/full, S/M/L) | Must for "real" menu | **v1** |
| Add-ons / modifier groups (min/max, price delta) | Must for "real" menu | **v1** |
| Channel pricing (dine-in/takeaway/delivery) + aggregator GST reversal | Must (once billing/delivery exists) | **Deferred** |
| Combos / meal deals; time-based (happy-hour) pricing | Should | **Deferred** |
| Multi-outlet base menu + per-outlet price/availability override + clone | Priya's #1 | **Deferred** (needs `Outlet`) |
| Bulk CSV import/export, bulk price/enable | Should (trial adoption) | **Deferred** |
| Field-level audit + approval flow on price/tax edits | Should | **Deferred** (86 audit is in v1) |

### Floor/kitchen staff (operational)
| Use case | Verdict | Phase |
|---|---|---|
| 86 carries **mandatory reason** (out-of-stock/quality/prep) | Must | **v1** |
| 86 **audit** (who disabled/re-enabled, when) | Must | **v1** |
| Default "until end of service", deliberate re-enable | Must | **v1** |
| **Never silently auto-re-enable** while still out (prompt) | Must | **v1** (UI prompt on expired 86) |
| Live **"86 board"** (what's off, who, return time) | Should | **v1** (lightweight) |
| One-item 86 in ≤2 taps **from POS/KDS** by line staff | Must *for a rush* | **Deferred** (no POS/KDS yet) |
| Instant local reflection on order surfaces / offline-tolerant 86 | Must *for a rush* | **Deferred** (no order surfaces/offline layer yet) |
| Cross-channel/aggregator kill ("POS only" honesty tag) | Should | **Deferred** (no aggregator integration) |
| Ingredient/recipe-level batch 86; auto-86 on stock depletion | Later | **Deferred** (needs inventory) |
| Photos/short-desc togg* per view (dense grid for rush) | Should | **Deferred** (no order-taking grid yet) |

\* v1 surfaces photos + short description in the manager list/detail only.

---

## 7. Deliberately deferred (premature until other systems exist)

- **POS/KDS 86 surfaces, offline queue, cross-channel/aggregator sync** — there is no POS, KDS, order-taking screen, or aggregator integration yet. Building "2-tap 86 from the KDS" now = UI with nothing to consume it. The **data model is designed to support it** (reason, audit, computed availability) so these plug in later without a rewrite.
- **Variants & modifiers** — **now in v1** per decision (`MenuItemVariant` + `ModifierGroup`/`Modifier` + join).
- **Channel pricing, combos, multi-outlet, bulk import, field-level audit** — real, but each depends on billing/outlet/CSV plumbing not yet present.

---

## 8. Decisions (resolved)

1. **GST** — corrected outlet-default + packaged override. ✅
2. **Variants & modifiers** — **included in v1** (half/full + add-ons). ✅
3. **Auto-re-enable** — compute-available-after `resumeAt` + visible "still off?" prompt (no cron). ✅
4. **Images** — Supabase Storage bucket **`elitale-restro`** (`SUPABASE_S3_BUCKET_NAME`); add `@aws-sdk/client-s3` + `sharp`. ✅
5. **GST optional** — many restaurants aren't registered → Restaurant defaults to `UNREGISTERED` (no GST); item GST fields optional. ✅
6. **86 scope** — manager-only via menu UI (no line-staff/KDS surface yet). ✅

---

## 9. Prerequisites / blockers to implement

- **`.env` fix (blocker for images):** `SUPABASE_S3_ACCESS_KEY` is declared **twice** — dotenv keeps the last line (the long secret), silently overriding the first (the access-key **id**), so the id is lost. Rename the secret line to **`SUPABASE_S3_SECRET_KEY`**. Storage reads `SUPABASE_S3_ENDPOINT / REGION / BUCKET_NAME (elitale-restro) / ACCESS_KEY (id) / SECRET_KEY`.
- `npm i @aws-sdk/client-s3 sharp`; `npx shadcn@latest add textarea switch dialog`.
- Additive migration `add_menu` (+ Restaurant tax columns). **No destructive reset** (additive only).

## 10. Verification (per AGENTS.md)

- TDD: `.spec.ts` first for every validator/repo/service/action; heavy coverage on `resolveItemTax` and `isAvailable`.
- `npx tsc --noEmit && npx eslint src && npx vitest run` — zero failures.
- Manual: sign in as a registered manager → create category → create item (with photo + GST) → 86 it "until end of day" with a reason → verify it reads unavailable → re-enable → confirm audit row.
