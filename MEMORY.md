# ElitaleRestro — Project Memory

> Accumulated decisions, completed work, and ongoing context. **Read at the start of every session.** Update at the end of significant sessions. Coding standards live in `AGENTS.md`.

---

## Project Snapshot

- **ElitaleRestro** — restaurant management app: **orders + inventory + menu + tables + billing**.
- **Users:** restaurant owners/operators (see `buyer` agent) and floor/kitchen staff (see `staff` agent).
- **Stage:** early scaffold. Prisma 7 wired up; first domain model (`User` = restaurant manager, **phone-primary**) with Zod validators + repository + service + a Vitest suite. Phone-first login UI in place (OTP backend not wired). Migration pending DB connectivity.

---

## Menu Management (2026-07-18) — COMPLETE

Full menu CRUD shipped (plan: `.plan/menu-crud.md`, planned with buyer + staff agents). Bottom-up, TDD.

- **Schema:** enums `GstRegistrationType`/`MenuItemType`/`DietaryType`/`Disable86Reason`; `Restaurant` tax profile (`gstRegistrationType` default **UNREGISTERED**, `serviceGstRate?`, `pricesTaxInclusive`, `gstin`, `sacCode`); models `MenuCategory`, `MenuItem`, `MenuItemImage`, `MenuItemAvailability` (the 86 = audit log), `MenuItemVariant`, `ModifierGroup`, `Modifier`, `MenuItemModifierGroup`. Migration `add_menu` applied.
- **Tax (corrected + optional):** `resolveItemTax()` — UNREGISTERED→no GST; served→outlet service rate; PACKAGED_GOODS→own `goodsGstRate`+HSN; COMPOSITION→not-separately-charged/inclusive. GST is opt-in.
- **Availability:** `isItemAvailable()` computes from `isActive` + category + open 86; 86 has reason + who/when + optional `resumeAt` (auto-return after time passes; UI shows it). Manager-only (no POS/KDS surface yet).
- **Variants + modifiers** (half/full, add-ons) included in v1. Reusable modifier groups via join.
- **Images:** Supabase Storage (S3 via `@aws-sdk/client-s3`, env `SUPABASE_S3_*` incl. `SUPABASE_S3_SECRET_KEY`), `sharp`→WebP ≤1600px, ≤3/item, ≤5 MB. `lib/storage.ts` + `services/menu-image.service.ts`.
- **Layers:** `lib/validators/menu.ts`; repos `menu-category`/`menu-item`/`menu-item-image`/`modifier-group`/`menu-availability`; services `menu-item`(tax+availability+`getMenu`→`MenuDTO`)/`menu-category`/`modifier`/`menu-availability`/`menu-image`; `lib/manager-auth.ts` (`getManagerContextOrNull`) + `withManagerValidation`; `actions/menu.actions.ts`.
- **UI:** `/dashboard/menu` (server) → `components/menu/` (`menu-manager`, `item-dialog`, `category-dialog`, `eighty-six-dialog`, `modifier-groups-dialog`, `image-manager`). shadcn (`dialog`/`switch`/`textarea` added) + `useServerAction` + `sonner`. Dashboard sidebar refactored: `dashboard/layout.tsx` holds the shell; sidebar "Menu" → `/dashboard/menu`. `next.config.ts` allows `*.storage.supabase.co` images.
- **Gotcha:** enforced `react-hooks/set-state-in-effect` — dialogs mount-only-while-open (state from `useState` initializers, no reset effect). Adding `manager-auth` import to `helpers.ts` required mocking `@/lib/manager-auth` in existing action specs.
- **Tests:** 146 pass (was 75). tsc + eslint clean.
- **Deferred:** channel pricing, combos, multi-outlet, bulk CSV, POS/KDS/aggregator 86 surfaces, field-level audit.

---

## POS & Orders (2026-07-18) — COMPLETE

POS + order lifecycle + billing/settlement shipped (plan: `.plan/pos-orders.md`, planned with buyer + staff agents). Bottom-up, TDD. Discounts + comps + multi-tender **included in v1** (user decision).

- **Schema (`add_orders` migration):** enums `OrderType`(DINE_IN/TAKEAWAY/DELIVERY), `OrderStatus`(OPEN/COMPLETED/VOID), `OrderLineState`(UNSENT/FIRED/SERVED/VOID), `PaymentMode`(CASH/UPI/CARD/OTHER), `DiscountType`(NONE/PERCENT/FLAT). `Restaurant.nextInvoiceSeq Int @default(1)`. Models `Order` (orderNumber per-restaurant, `invoiceNumber?`, `idempotencyKey @unique`, money Decimals, discount/comp/roundOff fields, void audit), `OrderItem` (**snapshots** name/variant/unitPrice/taxRate/taxKind/taxInclusive/state/isComp/sortOrder — never trust client prices), `OrderItemModifier` (snapshot), `Payment`.
- **Billing (`services/billing.ts`, pure/deterministic, client-safe):** `computeBill(lines, discount?)` — inclusive/exclusive tax back-out, comp lines free, proportional discount on pre-tax base, CGST=SGST split, round to nearest ₹1. Reused **client-side** for live cart/settle previews (imported into client components deliberately — it has no IO).
- **Layers:** `lib/validators/order.ts` (cart/create/addItems/fire/serve/void/settle; `idempotencyKey min8`; settle refine requires discount value when type set); `repositories/order.repository.ts` (`settleOrder` uses `prisma.$transaction` to atomically bump `nextInvoiceSeq` + write payments); services `order`(snapshot from `getMenu`, idempotency, per-line fire)/`settlement`(recompute authoritative bill, verify tender ≥ grandTotal −0.5)/`sales`(`getTodaySales`); `actions/order.actions.ts` (`withManagerValidation`).
- **UI:** `/dashboard/pos` (`components/pos/`: `pos-terminal`, `menu-item-grid`, `item-config-dialog` variant/modifier/qty/note, `cart-line-list`, `use-order-cart` hook, `types`) — tap→configure→cart, order type + table/customer/delivery-address, live totals, `Send to kitchen` (client `crypto.randomUUID()` idempotency key) → toast w/ **Print KOT** action. `/dashboard/orders` (`components/orders/`: `orders-board` Open/Completed + today's sales, `order-detail` add-round/fire/serve/void-line/void-order/settle, `settle-dialog` discount + multi-tender + change due, `add-items-dialog` reuses POS grid, `reason-dialog`, `print-button`). Printable **KOT** (`[id]/kot`, no prices) + **Invoice** (`[id]/invoice`, GSTIN/CGST/SGST/round-off, `?copy=1`→DUPLICATE, BILL OF SUPPLY when unregistered) via `window.print()`; dashboard chrome hidden with `@media print` in `globals.css`.
- **Sidebar:** added **POS** + wired **Orders** → `/dashboard/orders`.
- **Table settle (SHIPPED — `.plan/table-settle.md`):** the Open tab groups orders by table (`tableId ?? label:… ?? solo:id`); tables with 2+ open orders show `Settle table (N · ₹total)`. `TableSettleDialog` settles the **combined** bill with one split payment. Backend: validator `settleTableSchema` ({orderIds[], payments[]}); repo `settleManyOrders` (extracted `settleWithinTx`, one `$transaction`, sequential invoices, all-or-nothing); service `settleTable` + pure `allocatePayments` (waterfall split across orders, `tendered` not stored per slice — change shown in UI only), verifies combined tender ≥ total −0.5; action `settleTableAction` (`withManagerValidation`). **Separate invoice per order, no discount in v1.** Shared `components/pos/payment-entry.tsx` (`usePaymentEntry` + `PaymentEntryFields`) now backs both single + table settle (refactored `settle-dialog.tsx`).
- **Shared:** `OrderLineDTO.taxInclusive` added so client settle preview matches server billing; `lib/format.ts` (`formatCurrency`/`formatDateTime`/`formatTime`).
- **Tests:** 193 pass (was 158). tsc + eslint clean. New specs: billing, order validators, order repo (+`$transaction` mock), order/settlement/sales services, order actions.
- **Deferred:** KDS screen, per-fire KOT diffing (KOT prints all active lines), reservations/tables, offline queue, refunds/reopen, split-by-seat, reprint tracking.

---

## Tables (2026-07-18) — COMPLETE

Dining-tables CRUD + POS dine-in picker (plan: `.plan/tables.md`, planned with buyer + staff agents). Both panels: a table list without **occupancy awareness** is "a prettier text box" — silently opening a 2nd order on an occupied table was the #1 abandon trigger.

- **Schema (`add_tables` migration):** `DiningTable` (label unique per restaurant, `seats?`, `section?`, `sortOrder`, `isActive`, soft-delete `deletedAt`). `Restaurant.tables`. **`Order.tableId`** nullable FK + `table` relation + `@@index([tableId])` (real link, `tableLabel` kept as a snapshot).
- **Layers:** `lib/validators/table.ts` (+ `createOrderSchema.tableId`); `table.repository.ts` (`findTableByLabel` via compound unique, `reviveTable`, soft-delete sets `isActive:false`); `table.service.ts` (`getTables`/`listTablesForManager`, `createTable` **revives a soft-deleted label** instead of erroring, `TABLE_LABEL_TAKEN`/`TABLE_FORBIDDEN`, `resolveTableForOrder`); `table.actions.ts`. `order.service.createOrder` resolves `tableId` → authoritative label + ownership.
- **UI:** `/dashboard/tables` (`components/tables/`: `tables-manager` grouped by section + soft-delete confirm, `table-dialog`). POS Dine-in → `components/pos/table-picker.tsx` (section-grouped tappable buttons, occupied = amber dot; tapping an occupied table warns → *Open existing order* / *New order anyway*). Free-text table stays as fallback when no tables exist. `lib/tables.ts#groupTablesBySection` shared by manager + picker. POS page derives `occupied` (tableId→openOrderId) from `listOrders(["OPEN"])`.
- **Sidebar:** **Tables** → `/dashboard/tables`.
- **Tests:** 210 pass (was 193). tsc + eslint clean. New specs: table repo, table service (revive/ownership/label-clash), table actions, order.service `tableId` resolution.
- **Deferred:** occupancy state machine (dirty/reserved/timers), table tabs/transfer/merge, reservations, floor-map, drag-reorder, bulk quick-add ("T1–T20"), multi-outlet clone.

---

## Settings — Restaurant Profile (2026-07-18) — COMPLETE

Upgraded `/dashboard/settings` from a lone GST card into a full **restaurant profile** (plan: `.plan/settings-profile.md`, planned with buyer + staff agents). Agents' hard rules baked in: **FSSAI licence prints on the bill (legal)**, **brand name ≠ legal entity name** (both needed; legal name on the GST invoice), **PAN never printed**, **service options must actually drive the POS**.

- **Schema (`add_restaurant_profile` migration):** `RestaurantFormat` enum; `Restaurant` gained legalName, tagline, brandColor, logoUrl, coverUrl, address (line1/2, state, postalCode), website + socials (instagram/facebook/google), restaurantFormat, `cuisines String[]`, seatingCapacity, fssaiLicense, fssaiExpiry, panNumber, `serviceDineIn/Takeaway/Delivery` (booleans), `businessHours Json`. New `RestaurantImage` model (gallery, cap 8). Logo/cover = fixed storage keys + cache-busted url; gallery = per-image key. **Videos (follow-up):** `VideoKind` enum + `RestaurantVideo` model (external LINK or uploaded FILE, cap 6, profile-only); Server Action `bodySizeLimit` raised to 30 MB in `next.config.ts` (default 1 MB would have blocked >1 MB image/video uploads).
- **Layers:** `validators/restaurant.ts` (`updateProfileSchema` — FSSAI `\d{14}`, PAN, hours ×7, `≥1` service option; `businessHoursSchema`); `restaurant.repository` (`updateRestaurant`, gallery CRUD); `restaurant-settings.service` (`getRestaurantProfile`/`updateRestaurantProfile`/`getServiceOptions`/`fssaiStatus`); `restaurant-image.service` (sharp→WebP + Supabase Storage: logo/cover/gallery); `settings.actions` (profile + FormData image actions via a shared `runFileUpload` helper). `lib/business-hours.ts` + `lib/restaurant-format.ts` are client-safe.
- **UI:** `components/settings/` — `profile-header` (cover banner + circular logo + completeness chip), `restaurant-profile-form` (identity / location+contact / compliance / service+hours / details, one Save), `logo-uploader`/`cover-uploader`/`gallery-manager`/`videos-manager` (immediate upload via `use-image-upload` hook; videos also accept links, YouTube/Vimeo embedded via `lib/video.ts`), `business-hours-field`, `service-options-field`. FSSAI expiry shows amber/red warning. Reuses the existing `tax-settings-form`.
- **Integrations:** **Invoice** now prints logo (capped) + brand name + **legal entity name** + full address + **FSSAI No.** (+ existing GSTIN). **POS** order-type buttons are filtered to the enabled service options (cloud kitchen → delivery only); the **owner-chosen default** (Service options → “Default”, column `Restaurant.defaultOrderType`, refine: must be an enabled option) is pre-selected in the POS, falling back to the first enabled type.
- **Tests:** 228 pass (was 210). tsc + eslint clean. New specs: restaurant repo (profile + gallery), settings service (profile/fssaiStatus/serviceOptions), image service (sharp/storage mocks), settings actions. **Gotcha:** the 3 `makeRestaurant` fixtures (restaurant.repository/service, restaurant-settings.service specs) needed all new columns added.
- **Deferred:** multi-outlet per-outlet GSTIN/FSSAI, multi-brand-per-kitchen, region-aware compliance, service-charge %, reservations, autosave, "open now" from hours.

---

## Inventory (2026-07-19) — COMPLETE

Manual stock log + **recipe/BOM auto-depletion** (plan: `.plan/inventory.md`, planned with buyer + staff agents). Agents' spine: on-hand is a **running total of typed movements, never directly editable**; **bulk grids** are the adoption decider; auto-depletion **never blocks a sale** (on-hand may go negative). Owner chose the fuller build (recipes IN v1).

- **Schema (`add_inventory` migration):** `StockUnit` + `StockMovementType` (RECEIVE/WASTE/CORRECTION/SALE_DEPLETION) enums; `StockItem` (name, unit, category?, `onHand` Decimal(12,3), reorder/par/cost?, supplier free-text, soft-delete, unique `[restaurantId,name]`); `StockMovement` (signed `quantity` + `resultingOnHand` snapshot, reason/note, `orderId?`, `createdById`); `RecipeComponent` (`MenuItem`↔`StockItem`, qty in stock unit, unique `[menuItemId,stockItemId]`).
- **Layers:** `stock.repository` (`applyMovement`/`applyMovements` = atomic `increment` + movement in `$transaction`; `applyCounts` = set-to-counted CORRECTION); `stock.service` (CRUD w/ opening-stock movement + name-revive, receive/waste/bulk/count, `getLowStockCount`, `mapStock.isLow`); `recipe.repository`/`recipe.service` (`getRecipe`/`setRecipeComponent`/`removeRecipeComponent`/`listRecipes` grouped/`getRecipesMap`); `stock-depletion.service` (`depleteForLines`/`restoreForLines` aggregate recipe×qty). **`order.service` integration:** create/add-items → deplete; void-line/void-order → restore — all `.catch(() => undefined)` (best-effort, never blocks the order). `inventory.actions` + `recipe.actions`.
- **UI:** `/dashboard/inventory` (`inventory-manager` grouped by category + low badge; `stock-item-dialog`, `adjust-dialog` receive/waste + reason chips, `bulk-receive-dialog` grid, `count-dialog` grid) + history route `/dashboard/inventory/[id]`. **Recipe editor:** a "Recipe" action per item in the **menu manager** → `recipe-dialog` (menu page now also fetches `listStock` + `listRecipes`). **Dashboard** shows an amber "N items low" banner → inventory. Sidebar **Inventory** wired.
- **Tests:** 268 pass (was 241). tsc + eslint clean. New specs: stock repo ($transaction mock), stock service, recipe service, depletion service, inventory + recipe actions; order.service extended (mock depletion).
- **Deferred:** suppliers-as-entities + purchase orders + goods-receipt, variance reports, multi-outlet transfers, per-variant/modifier recipes, unit conversion (purchase≠stock unit), batch/expiry, stock→menu-86 auto-block.

---

## Current Codebase State (2026-07-18)
- `src/app/` — root `layout.tsx`/`page.tsx`/`globals.css`; `login/` (phone-first login); **`admin/`** — `layout.tsx` (admin-gated), `page.tsx` (overview), `users/`, `restaurants/` (+ `new/` onboard)
- `src/proxy.ts` — Next 16 Proxy: optimistic auth gate; unauthenticated → `/login`
- `src/actions/` — `helpers.ts` (`withValidation`, `withAdminValidation`), `restaurant.actions.ts` (+ specs)
- `src/services/` — `user.service.ts`, `admin-user.service.ts` (`listUsers`), `restaurant.service.ts` (`onboardRestaurant`, `listRestaurants`) (+ specs)
- `src/repositories/` — `user.repository.ts` (CRUD + `findUsersPaginated`, `getUserAuthState`), `restaurant.repository.ts` (+ specs)
- `src/hooks/` — `use-server-action.ts`; `src/types/` — `index.ts` (`ActionResult`/`Paginated`), `admin.ts` (DTOs)
- `src/lib/` — `utils.ts` (+ `serializeForClient`), `prisma.ts`, `admin-auth.ts`, `auth-helpers.ts`, `constants.ts`, `validators/{shared,user,admin}.ts`
- `src/components/` — `login-form.tsx`, `phone-input.tsx`; `admin/` (nav, shell, tables, onboard form); `shared/` (`PageHeader`, `EmptyState`); `ui/` shadcn primitives (`button`, `input`, `label`, `separator`, `field`, `select`)
- `prisma/schema.prisma` — `UserRole` enum + **`User`** (role/suspendedAt/deletedAt) + **`Restaurant`** model
- `prisma.config.ts` — Prisma 7 config; `src/generated/prisma/` — generated client (gitignored)
- `vitest.config.ts` — node env, `@` alias, `src/**/*.spec.ts` (54 specs)
- **Not yet present:** Resend (email) integration; POS/order/inventory modules. (DB live; migrations `init` + `admin` + `add_otp_challenge` applied.)

### Installed stack
Next 16.2.10 · React 19.2.4 · TypeScript 5 · Tailwind v4 · shadcn/ui + `@base-ui/react` · `lucide-react` · ESLint 9 · React Compiler.
**Data:** Prisma 7.8.0 + `@prisma/adapter-pg` + `pg` · `dotenv`. **Auth:** `twilio` (SMS OTP) + `jose` (session JWT). **Validation:** `zod` 4.4.3 + `libphonenumber-js`. **Tests:** `vitest` 4.1.10 · `tsx`. **DB:** **Prisma Postgres** (`db.prisma.io`), migrations applied.

---

## Decisions

- **Architecture:** layered `UI → Actions → Services → Repositories → DB` (details in `AGENTS.md`).
- **Data layer:** PostgreSQL (Supabase) + **Prisma 7**, using the new `prisma-client` generator (output `src/generated/prisma`, imported via `@/generated/prisma/client`) and the **`pg` driver adapter** (required by Prisma 7's query compiler). Client singleton in `src/lib/prisma.ts`; only repositories import it. Datasource url set in `prisma.config.ts` from `DATABASE_URL`.
- **Testing:** **Vitest** is the runner (`npm test`). TDD mandatory; co-locate `*.spec.ts`. Unit-test services by mocking the repository module; unit-test repositories by mocking `@/lib/prisma` (`vi.hoisted` + `vi.mock`).
- **User model:** `User` = platform account. **Phone is the primary identifier** (unique, E.164); `email` optional/unique. Roles via `UserRole` enum (`MANAGER` default, `ADMIN`, `SUPER_ADMIN`) + `suspendedAt`/`deletedAt` soft-delete. **`Restaurant`** = onboarded entity owned by a manager (`ownedRestaurants` relation).
- **Auth (wired):** custom **phone-OTP** login. `requestOtpAction` → 6-digit code, HMAC-hashed (`AUTH_SECRET`) into an `OtpChallenge` row, SMS via **Twilio** (`lib/twilio.ts`, Programmable Messaging + `TWILLIO_FROM_NUMBER`). `verifyOtpAction` → check code → find/create user → **`jose` JWT session cookie** `restro_session` (`lib/session.ts`). `getCurrentUserId()`/`requireUserId()` read the session; proxy checks the cookie (optimistic). Chose a custom session over Auth.js (simpler, fully server-action-native). No Twilio Verify (no Verify SID).
- **Docs wiring:** `AGENTS.md` = coding standards (source of truth); `MEMORY.md` = state/decisions. `CLAUDE.md` imports both.
- **Icons:** `@tabler/icons-react` is the intended set for feature code; scaffold + shadcn blocks currently ship `lucide-react`.
- **Fonts:** body/UI = **Inter** (`--font-sans`), headings = **Outfit** (`--font-heading`, auto-applied to `h1`–`h6` in `globals.css`), mono = **Geist Mono** (`--font-mono`). Wired in `layout.tsx` + `@theme inline`. (Fixed a bug where `--font-sans` self-referenced an undefined var → serif fallback.)

---

## Completed Work

### 2026-07-18 — Agent personas created (`.github/agents`)
- **`buyer.agent.md`** — "ICP Lie Detector": 6 restaurant-owner personas (independent single-location, multi-outlet QSR chain, cloud kitchen, fine dining, cafe/bakery, bar/pub) to stress-test features, UX, pricing, and marketing in restaurant math (covers, food cost %, pour cost, shrinkage, aggregator commission).
- **`staff.agent.md`** — "Floor & Kitchen Ops": 5 daily-operator personas (server, cashier, kitchen expeditor/KDS, floor manager, stores clerk) to evaluate flows for taps, batch actions, rush-readiness, and offline resilience.
- **`dharmendra.agent.md`** — senior architect / full-stack engineer (pre-existing, retained).
- Removed the empty `va.agent.md` placeholder (replaced by the restaurant-specific `staff.agent.md`).

### 2026-07-18 — Documentation
- Populated `AGENTS.md` as the coding-standards / architecture source of truth (preserving the managed `nextjs-agent-rules` block).
- Populated this `MEMORY.md`.

### 2026-07-18 — Prisma 7 data layer set up
- Installed Prisma 7.8.0 (`prisma`, `@prisma/client`) + `@prisma/adapter-pg`, `pg`, `dotenv`.
- `npx prisma init` scaffolded `prisma/schema.prisma` (`prisma-client` generator → `src/generated/prisma`) and `prisma.config.ts` (datasource url from `DATABASE_URL`); existing `.env` preserved.
- Added `src/lib/prisma.ts` — global-cached `PrismaClient` singleton via the `PrismaPg` adapter (named export, strict TS, boundary check on `DATABASE_URL`).
- Added npm scripts: `db:generate`, `db:migrate`, `db:deploy`, `db:studio`, and `postinstall: prisma generate`. Gitignored `/src/generated`; ESLint-ignored `src/generated/**`.
- Verified: `prisma generate` ✓, `tsc --noEmit` ✓, `eslint src` ✓.
- **Blocked:** first migration not run — Supabase **direct** connection is IPv6-only and unreachable from this IPv4 network (`P1001`). See Gotchas.

### 2026-07-18 — User (manager) data layer + phone-first login UI
- **Schema:** added `User` model (id cuid, `phone` unique, `phoneVerifiedAt?`, `email?` unique, `emailVerifiedAt?`, `name?`, `isActive`, timestamps); `prisma generate` ✓.
- **Validators:** `lib/validators/shared.ts` (`phoneSchema` E.164, `emailSchema` normalised, `idSchema`, `nameSchema`) + `lib/validators/user.ts` (`registerManagerSchema`, `addEmailSchema`).
- **Repository:** `repositories/user.repository.ts` — `createUser`, `findUserById/ByPhone/ByEmail`, `updateUser`.
- **Service:** `services/user.service.ts` — `registerManager` (phone-unique), `getManagerById/ByPhone`, `addEmailToManager` (email-unique). Domain errors: `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_IN_USE`, `USER_NOT_FOUND`.
- **Tests (Vitest):** added `vitest.config.ts` + `test`/`test:watch` scripts. 29 specs across validators/repo/service. `npm test` ✓, `tsc` ✓, `eslint` ✓.
- **UI:** added shadcn `login-05` block (`npx shadcn add login-05`) and adapted `components/login-form.tsx` to **phone-first** (ElitaleRestro branding, `tel` input, client-side `phoneSchema` validation, “we’ll text a one-time code”). Removed email/social login. Submit handler has a `TODO` for the request-OTP server action.
- **Blocked:** `prisma migrate dev` still fails `P1001`; the `users` table is defined + generated but not yet created in the DB.

### 2026-07-18 — Auth proxy (Next 16 middleware → proxy)
- Added `src/proxy.ts` (`export function proxy` + `config.matcher`). Optimistic cookie check (edge-safe, no DB) for the Auth.js session cookie (`authjs.session-token` / `__Secure-authjs.session-token`).
- Behaviour: unauthenticated → redirect to `/login?callbackUrl=…`; authenticated on a public route → redirect to `/`. Public routes: `/login`. Matcher excludes `api`, `_next/*`, and static asset files.
- Until Auth.js sets the session cookie, **every non-`/login` route redirects to `/login`** (the requested default). `tsc` ✓, `eslint` ✓.

### 2026-07-18 — Login UI: fonts + phone country selector
- **Fonts:** Inter (body) + Outfit (headings, auto-applied to `h1`–`h6`) + Geist Mono. Fixed `--font-sans` wiring bug (self-referenced undefined var → serif fallback). Tab title → “ElitaleRestro”.
- **`phone-input.tsx`:** reusable phone field — shadcn `select` (Base UI) **country column** (flag + dial code) + national number `Input`, composing **E.164** via `libphonenumber-js`. Country is **auto-detected from the visitor's IP** (GeoJS `get.geojs.io`, client-side so it works in local dev), falling back to browser locale, then `IN`. Emits E.164 to the parent via an effect (so async country changes propagate). Wired into `login-form.tsx`.
- Added deps: `libphonenumber-js`, shadcn `select`. `tsc` ✓, `eslint` ✓, visually verified (IP → India 🇮🇳 +91).

### 2026-07-18 — Admin panel + users list + restaurant onboarding
- Studied `/Users/soni/work/elitale/coldbirds/sequence` and ported its layered plumbing. Plan in `.plan/admin-panel.md`.
- **Schema:** `UserRole` enum (`MANAGER`/`ADMIN`/`SUPER_ADMIN`) + `User.role/suspendedAt/deletedAt`; new **`Restaurant`** model (owner = User). `prisma generate` ✓.
- **Shared plumbing:** `types/` (`ActionResult`, `success`/`failure`, `Paginated`), `actions/helpers.ts` (`withValidation`/`withAdminValidation`, Zod-schema-inferred), `hooks/use-server-action.ts`, `lib/utils#serializeForClient`.
- **Admin gate:** `lib/admin-auth.ts` (`getAdminContextOrNull`/`requireAdminPage`, DB-backed role check) over `lib/auth-helpers.ts#getCurrentUserId` seam (fails closed in prod; `DEV_ADMIN_USER_ID` for dev preview).
- **Data/logic:** `repositories/{user (+ list/authState), restaurant}`, `services/{admin-user (listUsers), restaurant (onboardRestaurant, listRestaurants)}`, `actions/restaurant.actions.ts`. Onboard = find-or-create owner by phone + unique slug.
- **UI:** `/admin` (shell + nav + overview counts), `/admin/users` (table), `/admin/restaurants` (table + `/new` onboard form via `useServerAction` + `PhoneInput`). Shared `PageHeader`/`EmptyState`.
- **Tests:** 54 specs (repos/services/actions/admin-auth/helpers/validators). `npm test` ✓, `tsc` ✓, `eslint` ✓.
- **Not live yet:** needs the two blockers resolved. No new deps; icons = lucide (avoid per-feature mixing).

### 2026-07-18 — DB live + admin user seeded
- `.env` `DATABASE_URL` now points at **Prisma Postgres** (`db.prisma.io`, `sslmode=require`) — reachable; migrations `init` + `admin` applied. The Supabase IPv6 blocker no longer applies.
- Added `prisma/seed.ts` (idempotent upsert) + `db:seed` script; installed `tsx` to run TS scripts.
- Seeded **Dharmendra Soni** (`+917597365803`, `soni@elitale.com`) as **`ADMIN`** — id `cmrq5aupg0000u96iwmkj0lyr`. `tsc` ✓, `eslint` ✓.

### 2026-07-18 — Phone-OTP auth wired (Twilio + jose)
- **Schema:** `OtpChallenge` model (phone, hashed code, expiry, attempts, consumedAt) + migration `add_otp_challenge`.
- **lib:** `otp.ts` (generate + HMAC-hash), `twilio.ts` (`sendSms`), `session.ts` (`jose` JWT `restro_session` cookie: create/get/destroy). `auth-helpers.ts` now session-backed (`getCurrentUserId`, `requireUserId`).
- **repo/service:** `otp.repository.ts`; `auth.service.ts` (`requestOtp` — 30s resend limit; `verifyOtp` — 5-attempt cap, 5-min TTL, find-or-create user).
- **actions:** `auth.actions.ts` — `requestOtpAction`, `verifyOtpAction` (sets session), `logoutAction`.
- **UI:** two-step `login-form.tsx` (phone → 6-digit code via `useServerAction`), `/dashboard` (protected, `requireUserId` + sign-out). Proxy checks `restro_session`; signed-in users land on `/dashboard`.
- **Tests:** 72 specs. `npm test` ✓, `tsc` ✓, `eslint` ✓. Live: `/login` 200, `/dashboard` 307 (redirects when signed out).
- `DEV_ADMIN_USER_ID` is set to the admin id → `getCurrentUserId()` returns the admin in dev even without a session.

---

## Pending / Next Steps

- **Add-email-later flow:** UI + action calling `addEmailToManager` (Resend for verification/notifications).
- First operational module (**Menu** or **Order/POS**), bottom-up per `AGENTS.md`.

---

## Staff module (SHIPPED — `.plan/staff.md`)

- **`/dashboard/staff`** — manager-only. Add/edit/remove staff grouped by role (Waiter / Kitchen / Management), avatar + status badge + employee ID + phone + PIN-set indicator. Sidebar wired (`UsersIcon`).
- **Roles/status enums:** `StaffRole` (WAITER/KITCHEN/MANAGEMENT), `StaffStatus` (ACTIVE/ON_LEAVE/INACTIVE), `EmploymentType`, `Gender`. Model `Staff` (migration `add_staff`): full profile — photo, name, phone, email?, address, DOB, gender, joining/employment, emergency contact, notes. **No salary/bank/Aadhaar** (deliberately cut). `@@unique([restaurantId, employeeCode])`; soft-delete via `deletedAt` (revive on re-add of same code).
- **PIN, not login:** "password" = a **4–6 digit POS PIN**, HMAC-hashed via `lib/staff-pin.ts` (`hashStaffPin(pin, restaurantId)` = `createHmac("sha256", AUTH_SECRET).update(`${restaurantId}:${pin}`)`). **PINs are shareable across staff** (revised 2026-07-19, migration `staff_shared_pin`): the `@@unique([restaurantId, pinHash])` constraint, `findStaffByPinHash` lookup, and `STAFF_PIN_TAKEN` guard were all removed. Trade-off: a PIN can't identify *who* entered it — revisit if PIN login / attribution lands in v1.1. Manager phone-OTP stays the **only** real login; staff never log in. DTO exposes `hasPin`, never `pinHash`.
- **Layers:** `staff.repository` → `staff.service` (create/update/delete/resetPin, code-taken + pin-taken guards, revive-if-soft-deleted) + `staff-image.service` (sharp → 512×512 webp → `staff/{id}/photo.webp`, cache-busted url). Actions `staff.actions.ts` via `withManagerValidation`; photo upload/remove are FormData actions (need an existing `staffId`, so **photo uploader shows only in edit mode**). Validators in `lib/validators/staff.ts` (pin `/^\d{4,6}$/`). Attribution (per-staff order/void) **deferred to v1.1**.

---

## Manager sign-in PIN (SHIPPED — `.plan/manager-pin-login.md`)

- **Goal:** managers set a PIN on `/dashboard/settings` to skip the SMS OTP on repeat logins. **Owner-chosen model: phone + PIN from anywhere** (weaker; hardened with compensating controls). OTP always stays as fallback.
- **Login is phone-first + auto-routed** (no method chooser): `startLoginAction({phone})` → `startLogin()` in `auth.service.ts` returns `"pin"` (phone has a usable PIN) or `"otp"` (sends code). Login form (`login-form.tsx`) has 3 steps: phone → **pin** (Forgot PIN? / lockout → OTP) → **code**. Removed the old debug `useEffect(console.log)`.
- **Model:** `User` gained `pinHash`/`pinUpdatedAt`/`pinFailedAttempts`/`pinLockedUntil` (migration `add_manager_pin`, additive). **Hashing = scrypt + per-user salt** via `lib/pin.ts` (`scrypt$salt$hash`, `node:crypto`, constant-time) — NOT the deterministic staff HMAC (login PIN needs salt + slow KDF).
- **Service `pin-auth.service.ts`:** `setManagerPin`/`removeManagerPin`/`getPinStatus`/`verifyPinLogin`. Lockout: `MAX_PIN_ATTEMPTS=5` → `pinLockedUntil = now+15min` (`PIN_LOCKED`); wrong PIN = generic `PIN_INVALID` (no enumeration). Successful OTP login resets counters (unlocks). `verifyPinLogin` re-checks eligibility (deleted/suspended/inactive) every time.
- **Actions `pin.actions.ts`:** `startLoginAction`, `verifyPinAction` (→ `createSession`), `setPinAction`/`removePinAction` (auth via `getCurrentUserId`, throw/return `NO_SESSION`). Validators `managerPinSchema`/`setPinSchema`/`verifyPinSchema` in `lib/validators/auth.ts`.
- **Settings UI:** `sign-in-pin-card.tsx` (status + Set/Change/Remove, no re-auth) + `pin-dialog.tsx` (PIN + confirm, masked). Page passes `getPinStatus(ctx.userId)`.
- **Accepted residual risk:** phone+PIN-anywhere reveals PIN-presence via the router + has no possession factor. §12 upgrade path = device-binding + SMS-on-PIN-login alert (keep modular).

---

## Restaurant username (SHIPPED)

- **`Restaurant.username String? @unique`** (migration `add_restaurant_username`, nullable-unique so additive; Postgres allows multiple NULLs). Distinct from `slug`.
- **Auto-generated 7-char lowercase alphanumeric** via `lib/username.ts` (`generateUsername`, `randomInt`). `generateUniqueUsername()` in `restaurant.service.ts` (loops vs `findRestaurantByUsername`, mirrors `uniqueSlug`). Set at onboarding; **lazily generated + persisted** on first `getRestaurantProfile` when null (`resolveUsername`).
- **Settings UI:** `components/settings/username-card.tsx` (input + Save + "Generate new"); `updateUsernameAction` (unique-checked, `USERNAME_TAKEN`) + `regenerateUsernameAction`. Validator `usernameSchema` = `/^[a-z0-9_]{3,20}$/` (lowercased). DTO gained `username`.

---

## Staff login — waiter/kitchen (SHIPPED — `.plan/staff-login.md`)

- **`/u/[username]/login`** — restaurant-scoped (username = `Restaurant.username`). Waiter/kitchen sign in via a **name/photo picker → PIN pad** (`listLoginStaff` lists ACTIVE waiter/kitchen; tapping a tile supplies its `employeeCode` behind the scenes — login action/service still take employeeCode+pin). `MANAGEMENT` excluded; manager OTP login untouched. **Tradeoff:** the waiter/kitchen roster is visible on the public login page. Landing `/u/[username]` is a **minimal role stub** (POS/KDS = fast-follow).
- **Separate session:** `lib/staff-session.ts` → `restro_staff` jose JWT (`sub=staffId`, `restaurantId`, `role`), **12h**, httpOnly. Fully independent of the manager `restro_session`. `lib/staff-auth.ts` `getStaffContextOrNull()` **re-reads the Staff row every request** (instant deactivation) + enforces ACTIVE + role∈{WAITER,KITCHEN} + session.restaurantId === staff.restaurantId.
- **Service `staff-auth.service.ts`:** `verifyStaffLogin(restaurantId, employeeCode, pin)` (uses `hashStaffPin`; generic `STAFF_LOGIN_INVALID`; lockout `MAX_STAFF_ATTEMPTS=5` → 60s `STAFF_LOGIN_LOCKED`) + `getStaffLoginRestaurant(username)`. Staff lockout cols `loginFailedAttempts`/`loginLockedUntil` (migration `add_staff_login_lockout`) + repo `recordStaffLoginFailure`/`resetStaffLoginCounters`.
- **Actions `staff-auth.actions.ts`:** `staffLoginAction` (resolve restaurant by username → verify → `createStaffSession`) + `staffLogoutAction(username)`. Validator `staffLoginSchema` (username+employeeCode+pin) in `lib/validators/staff.ts`.
- **Proxy:** `/u/**` routed on `restro_staff` (separate from manager cookie); `/u/[username]/login` public, other `/u` pages require the staff cookie. UI: `app/u/[username]/login` + `page` (gated), `components/staff-login/staff-login-form.tsx` (numeric PIN pad) + `staff-home.tsx`.
- **Accepted residual (agents):** shared PINs ⇒ identity comes from Employee ID (login attribution fine); v1.1 = waiter-POS/kitchen-KDS destination, name/photo grid on provisioned device, station-mode KDS, unique PINs for void/comp accountability, offline.

---

## Waiter ordering (SHIPPED — `.plan/waiter-ordering.md`)

- **The work screen behind the waiter login.** `/u/[username]` (WAITER) = **open-tables home** (`WaiterHome`, lists OPEN orders) + New order. `/u/[username]/order/new` and `/order/[orderId]` = `OrderBuilder` (mobile: search + category chips + one-tap items, `ItemConfigDialog` reused for variants/modifiers, pinned bottom cart bar + review sheet, optional after-the-fact phone, table grid for dine-in). Kitchen still gets the stub.
- **Reuses the POS logic wholesale:** `order.service` `createOrder`/`addItems`+`fireOrder`/`listOrders`/`getOrder`, `getMenu`, `getTables`, `getServiceOptions`, `useOrderCart` + `CartLine`/`toBillLine`/`computeBill`. **Send = fire-all**, idempotent (`idempotencyKey`) for resilient retry (D1).
- **Attribution (D3):** `Order.placedById` widened to nullable + new **`Order.placedByStaffId`** (migration `add_order_staff_attribution`; also widened `Payment.receivedById` + `StockMovement.createdById` to nullable so a null-userId waiter actor flows through). `OrderContext` gained `userId: string | null` + optional `staffId`; waiter create writes `placedByStaffId`, `placedById=null`.
- **Auth:** `withStaffValidation(schema, handler, { role })` in `actions/helpers.ts` (mirrors manager wrapper; `NO_STAFF_SESSION`/`STAFF_FORBIDDEN`). Actions `actions/staff-order.actions.ts`: `createWaiterOrderAction` + `addWaiterItemsAction` (both `{ role: "WAITER" }`). **Waiter has zero price/void/comp/settle powers (D4/D5)** — those actions stay `withManagerValidation`; removing an **unsent** cart line before Send is the only "edit".
- **Gotcha:** `helpers.ts` now imports `@/lib/staff-auth` → every action spec that mocks manager/admin-auth must also `vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }))` (else it loads real prisma).
- **v1.1 (agents):** true offline-first, kitchen KDS (add-on tickets flagged), coursing, split-by-seat, floor map, bar tabs + waiter payment, per-line attribution, tableside manager-PIN void.

---

## Kitchen display / KDS (SHIPPED — `.plan/kds.md`)

- **The kitchen work screen behind the KITCHEN login.** `/u/[username]` (KITCHEN) = `KitchenDisplay` — a single vertical list of ticket cards (one per OPEN order with active kitchen lines), oldest-fired first. Each card: title (table/takeaway), elapsed timer, status pill, item lines (variant · modifiers · "note"), a flagged **＋ Added** group for add-ons, and one big **advance button**. ~10s polling via `router.refresh()` in a `useEffect` interval (no websockets). Replaced the old `StaffHome` stub.
- **Lifecycle (whole-ticket, one tap):** line states extended `UNSENT → FIRED(=Waiting) → PREPARING → PREPARED → SERVED → VOID` (migration `add_line_prep_states`, additive enum). Order **kitchen status is derived**, never stored: all active FIRED → WAITING; all PREPARED → READY; else PREPARING; all SERVED/VOID → off board. Advance is deterministic: any FIRED → button "Start" (FIRED→PREPARING); else PREPARING present → "Mark ready" (PREPARING→PREPARED); all PREPARED → no button (Ready for pickup). A fired **add-on** re-triggers "Start".
- **Add-on batching:** `lineCreate` (order.repository) now stamps **one** `firedAt` per fire batch (was per-item). Tickets group active lines by exact `firedAt`; earliest batch = original, later = `isAddOn: true` (rendered "＋ Added").
- **Waiter clears Ready:** waiter taps **Picked up** on the add-items screen when a ticket is READY → `markPickedUpAction` (role WAITER) → `advanceLineStates(orderId, PREPARED, SERVED)` → lines leave the board. Kitchen cannot void/comp/price — **status only**.
- **Layers:** `lib/kitchen.ts` (client-safe pure: `deriveKitchenStatus`, `kitchenAdvanceLabel`, labels) → `repositories/order.repository#advanceLineStates(orderId, from, to)` (bulk `updateMany`) → `services/kitchen.service.ts` (`listKitchenTickets` / `advanceTicket` / `markPickedUp`, reuses `loadOwnedOrder`) → `actions/kitchen.actions.ts` (`advanceTicketAction` {role KITCHEN}, `markPickedUpAction` {role WAITER} via `withStaffValidation` + `kitchenTicketSchema`). Types in `types/kitchen.ts` (`KitchenTicketDTO/Batch/Line`); DTO `OrderLineState` widened.
- **Status visibility:** shared `components/shared/kitchen-status-badge.tsx` (`KitchenStatusBadge`, renders nothing when no active lines) on **waiter home** rows, **manager** open-tickets rows, and the waiter **add-items** header.
- **Tests:** +26 specs (kitchen lib/service/actions), full suite **390 green**. `tsc` ✓, `eslint src` ✓. Route smoke: `/u/x` 307 → login.
- **v1.1 (agents):** station routing (hot/cold/bar), per-item bump, KDS delay nudge to waiter, station-mode kiosk, sound/flash on new ticket, offline queue.

---


## Notes / Gotchas

- **`AGENT.md` vs `AGENTS.md`:** `.github/copilot-instructions.md` says "AGENT.md", but the live file imported by `CLAUDE.md` is **`AGENTS.md`**. Treat `AGENTS.md` as the source of truth.
- **copilot-instructions template drift:** `.github/copilot-instructions.md` was adapted from the coldBirds project (its title still reads "coldBirds"). Some rules there are coldBirds-specific and do **not** apply here (e.g., Cloudflare/Resend SDKs, cold-email domain). `AGENTS.md` reflects the restaurant project's actual conventions.
- **Next.js 16:** read `node_modules/next/dist/docs/` before writing Next code — APIs differ from training data. Notably **`middleware.ts` is renamed to `proxy.ts`** (`export function proxy(request: NextRequest)`, optional `config.matcher`); the old `middleware` convention is deprecated.
- **Never hard-reset the database** once one exists — it wipes NextAuth session rows and causes redirect/reload loops in dev. Prefer additive migrations; ask before any destructive change.
- **Supabase direct connection is IPv6-only.** `db.<ref>.supabase.co:5432` has no IPv4 `A` record → `P1001` on IPv4-only networks. Use the **Supavisor pooler** instead (username `postgres.<project-ref>`, host `aws-0-<region>.pooler.supabase.com`): session pooler `:5432` for migrations, transaction pooler `:6543?pgbouncer=true` for the serverless app. Copy the exact string from Supabase → Project Settings → Database → Connection string (region appears to be `ap-south-1`). Also confirm the project isn't paused (free tier auto-pauses).
- **Prisma 7 specifics:** client is generated (not shipped in `@prisma/client`) to `src/generated/prisma` via the `prisma-client` generator; import from `@/generated/prisma/client` (model type is `User`, aliased from `Prisma.UserModel`). The query compiler **requires a driver adapter** (`@prisma/adapter-pg`) — `new PrismaClient()` won't connect without one. `prisma.config.ts` loads env via `dotenv` and holds the datasource url.
- **Notification/auth env vars (exact names):** Resend → `AUTH_RESEND_KEY`, `RESEND_FROM_EMAIL` (still a coldBirds/tax `from` address — update before sending). Twilio → **`TWILLIO_A_SID`**, `TWILLIO_AUTH_SECRET`, `TWILLIO_PRIMARY_TOKEN`, `TWILLIO_FROM_NUMBER` (note the misspelled `TWILLIO` prefix — use verbatim or rename the vars). Also `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `CRON_SECRET`.
- **Twilio SMS:** sending from the US `TWILLIO_FROM_NUMBER` to Indian (`+91`) numbers is **authorized** — no DLT caveat. **Real OTP is sent in every environment (dev + prod)**: `requestOtp` always calls Twilio with no `NODE_ENV` gate; only the Vitest suite mocks `sendSms` (automated tests must never fire real SMS). `AUTH_SECRET` is reused to HMAC OTP codes and sign the `restro_session` JWT.
