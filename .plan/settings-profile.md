# Settings → Restaurant Profile (v1)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> Upgrades `/dashboard/settings` (today: only a GST/Tax card) into a full **Restaurant Profile**.
> Layered (UI → Actions → Services → Repositories → DB), TDD-first.
> **Status: SHIPPED (2026-07-18).** Full restaurant profile + branding/media + service→POS + FSSAI/legal-name on invoice live. 228 tests pass. See `MEMORY.md` → "Settings" for the as-built summary.
> **Follow-up (2026-07-18):** added **videos** to the media section — both external links (YouTube/Instagram/Vimeo embeds) and uploaded files (MP4/WebM/MOV ≤25 MB, cap 6), profile-only (never on bill/KOT). `RestaurantVideo` model; raised Server Action `bodySizeLimit` to 30 MB. 240 tests.

---

## 0. TL;DR — what the agents changed

Both panels were blunt: **settings is a form nobody revisits.** Only build fields that (a) legally must hit the bill, (b) are customer-facing, or (c) drive a real behaviour/report. Everything else is optional and must never block completion.

- **FSSAI licence number is legally required on the customer bill** (14-digit) → **must-have + must print on the invoice.** FSSAI **expiry** = internal warning before it lapses (never printed).
- **Two-name trap (the #1 issue):** brand name ≠ legal entity name. **Header = brand name; GST tax invoice identity = legal entity name.** Need BOTH — corporate guests can't claim a GST invoice with the wrong name. **PAN = back-office only, never printed.**
- **Service options must DO something** — wire `dine-in / takeaway / delivery` toggles to the **POS order-type buttons** (cloud kitchen turns dine-in off), or the agents say cut them.
- **Logo print trap:** owners upload a big colour PNG; keep it **capped/small** on the invoice header so it doesn't shove line items off-page.
- **Cut as vanity (0/6 owners):** brand accent colour, cover photo, gallery, tagline, service radius, geo/Maps link, break windows, alternate phone, WhatsApp, Instagram/Facebook/Google, parking, landmark.
- **Defer (needs a dependent feature or multi-region/outlet first):** multi-outlet per-outlet GSTIN/FSSAI, multi-brand-per-kitchen, region-aware compliance, service-charge %, reservations (dead until a reservation flow exists), autosave.

---

## 1. Field set (v1)

### A. Bill essentials — printed on the invoice / legally required
| Field | Notes |
|---|---|
| **Brand name** (`name`, exists) | Invoice **header** + POS header |
| **Legal entity name** (`legalName`, new) | Invoice **identity line** (GST tax invoice) |
| **Logo** (`logoUrl`, new) | Invoice header, capped small |
| **Address** (`addressLine1/2`, `state`, `postalCode` new; `city`/`country` exist) | Invoice + POs |
| **Phone** (exists) · **Email** (exists) | Invoice footer |
| **GSTIN + tax** (exists) | Already prints (unchanged) |
| **FSSAI licence no.** (`fssaiLicense`, new, 14-digit) | **Prints on invoice (legal)** |
| **FSSAI expiry** (`fssaiExpiry`, new) | **Internal warning** only, not printed |

### B. Service & hours — operational, wired to behaviour
| Field | Notes |
|---|---|
| **Service options** (`serviceDineIn`/`serviceTakeaway`/`serviceDelivery`, new booleans; ≥1 true) | **Filters POS order-type buttons** + default type |
| **Business hours** (`businessHours` Json, new) | Per-weekday open/close + closed toggle; sensible defaults pre-filled |

### C. Optional details — clearly optional, never blocks completion
| Field | Notes |
|---|---|
| **Format** (`restaurantFormat` enum, new) | Fine dining / Casual / QSR / Café / Cloud kitchen / Bar / Bakery / Food truck / Other; can prefill service options |
| **Cuisines** (`cuisines String[]`, new) | Curated multi-select chips |
| **Seating capacity** (`seatingCapacity` Int?, new) | Floor reference |
| **Website** (`website` String?, new) | Optional |
| **PAN** (`panNumber` String?, new) | Back-office KYC, **never printed** |

> Everything in §C sits in a collapsed "Optional — improve your profile" area so it never slows the owner down.

### D. Branding & media (confirmed in-scope; makes it look good)
| Field | Notes |
|---|---|
| **Tagline** (`tagline`, new) | Shown on profile; **not** auto-printed on the thermal bill (staff: wastes lines) |
| **Brand colour** (`brandColor`, new hex) | Accent on the settings/profile header preview only |
| **Cover photo** (`coverUrl`, new) | Profile header banner |
| **Gallery** (`RestaurantImage[]`, new, ≤8) | Grid, add/remove (reuses the menu-image pipeline) |
| **Socials** (`instagramUrl`/`facebookUrl`/`googleUrl`, new) | Optional contact card |

---

## 2. Data model

`Restaurant` gains (all nullable or defaulted — additive, no reset):

```prisma
enum RestaurantFormat {
  FINE_DINING
  CASUAL_DINING
  QSR
  CAFE
  CLOUD_KITCHEN
  BAR
  BAKERY
  FOOD_TRUCK
  OTHER
}

// on model Restaurant:
legalName        String?
tagline          String?
brandColor       String?
logoUrl          String?
coverUrl         String?
addressLine1     String?
addressLine2     String?
state            String?
postalCode       String?
website          String?
instagramUrl     String?
facebookUrl      String?
googleUrl        String?
restaurantFormat RestaurantFormat?
cuisines         String[]          @default([])
seatingCapacity  Int?
fssaiLicense     String?
fssaiExpiry      DateTime?
panNumber        String?
serviceDineIn    Boolean           @default(true)
serviceTakeaway  Boolean           @default(true)
serviceDelivery  Boolean           @default(false)
businessHours    Json?             // validated [{day:0-6,isClosed,opensAt,closesAt}] ×7
images           RestaurantImage[]
```

```prisma
model RestaurantImage {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  url          String
  sortOrder    Int        @default(0)
  createdAt    DateTime   @default(now())

  @@index([restaurantId])
}
```

Migration: **`add_restaurant_profile`**. Logo/cover stored in Supabase Storage at deterministic keys `restaurants/{id}/logo-{ts}.webp` / `cover-{ts}.webp`; `logoUrl`/`coverUrl` persisted (cache-busted); old object deleted on replace/remove. Gallery images at `restaurants/{id}/gallery-{uuid}.webp` → `RestaurantImage` rows (cap 8).

---

## 3. Layers (bottom-up, TDD)

- **Validators** `lib/validators/restaurant.ts` — add `updateProfileSchema`:
  - `name` (1–120), `legalName?` (≤160), address parts, `website?` (url), `restaurantFormat?` (enum), `cuisines` (string[] ≤ 20), `seatingCapacity?` (int 1–100000), `fssaiLicense?` (`/^\d{14}$/`), `fssaiExpiry?` (date), `panNumber?` (`/^[A-Z]{5}\d{4}[A-Z]$/`), the 3 service booleans (`.refine` ≥1 true), `businessHours` (array len 7, `HH:MM` regex).
  - `logoUploadSchema` handled via `FormData` (like menu images).
- **Repository** `repositories/restaurant.repository.ts` — add `updateRestaurantProfile(id, data)`, `setRestaurantLogo(id, url)`, `clearRestaurantLogo(id)`. (`findRestaurantById` exists.)
- **Service** `services/restaurant-settings.service.ts` — add `getRestaurantProfile(id) → RestaurantProfileDTO` (serialize Decimals/Dates), `updateRestaurantProfile(id, input)`, `fssaiStatus(expiry)` (`ok | expiring | expired`), and logo `uploadLogo`/`removeLogo` (reuse `lib/storage.ts` + `sharp`→WebP ~512px, ≤2 MB, like `menu-image.service`).
- **Actions** `actions/settings.actions.ts` — add `updateRestaurantProfileAction` (`withManagerValidation`), `uploadLogoAction`, `removeLogoAction`.
- **Types** `types/settings.ts` — add `RestaurantProfileDTO`, `RestaurantFormat`, `BusinessHoursDTO`, `FssaiStatus`.

---

## 4. UI — `/dashboard/settings` (make it look good)

Single scrollable page, **bill essentials first**, optional collapsed:

- **Header card:** **cover-photo banner** + circular **logo dropzone** (upload/remove, immediate) over it, brand name + format badge + a **"Bill essentials" completeness** chip; **brand colour** used as the header accent.
- **Business identity** card: brand name, legal entity name, tagline, brand colour.
- **Media** card: cover uploader + **gallery** grid (add/remove, ≤8).
- **Location & contact** card: address block, phone, email, website, Instagram/Facebook/Google.
- **Compliance** card: FSSAI licence + expiry (with **amber warning** when expiring ≤30d / red when expired), PAN. *(GST stays its own card.)*
- **Service & hours** card: 3 service-option switches + weekly hours grid (defaults pre-filled).
- **Optional details** card (collapsed): format, cuisines chips, seating capacity.
- **GST / Tax** card: existing `TaxSettingsForm`, unchanged.

Components `components/settings/`: `restaurant-profile-form` (one **Save changes** for the text/select/switch/hours fields), `logo-uploader`, `cover-uploader`, `gallery-manager`, `business-hours-field`, `service-options-field`, `profile-completeness`. Reuse shadcn Card/Field/Input/Select/Switch + `useServerAction` + `sonner`.

---

## 5. Integrations (fields that "do something")

- **Invoice** (`/dashboard/orders/[id]/invoice`): header shows **logo (capped ~48px)** + **brand name**; identity line shows **legal entity name**; add **full address** + **FSSAI No.** (below GSTIN). Two-name + FSSAI-on-bill = the agents' hard requirements.
- **POS** (`/dashboard/pos`): order-type buttons filtered to enabled **service options**; default order type = first enabled (takeaway → dine-in → delivery). Page passes the 3 booleans; terminal filters `ORDER_TYPES`.
- **FSSAI expiry**: settings shows a warning banner; (dashboard nudge deferred).

---

## 6. Tests (TDD, co-located `.spec.ts`)

- `restaurant.repository.spec` — `updateRestaurantProfile`, logo set/clear (+ add new columns to the 3 `makeRestaurant` helpers).
- `restaurant-settings.service.spec` — `getRestaurantProfile` mapping, `updateRestaurantProfile`, `fssaiStatus` boundaries.
- logo service spec — upload → `sharp`→WebP→`putObject`; remove → `deleteObject` (constructable S3 mocks).
- `settings.actions.spec` — delegation + `NO_RESTAURANT` + FSSAI/PAN validation rejects.
- Gate: `tsc --noEmit` + `eslint src` + full `vitest run`, zero failures.

---

## 7. Deferred (explicitly out of v1)

- **Multi-outlet** (per-outlet GSTIN/FSSAI/address) and **multi-brand-per-kitchen** — needs an `Outlet`/`Brand` model; today profile is `restaurantId`-scoped (= one outlet).
- **Region-aware compliance** (non-India: liquor licence, US tax) — India-only for now.
- **Service-charge %** on the bill — needs `computeBill` changes; legally voluntary in India.
- **Reservations toggle** (dead until a reservation flow exists), **"open now"** banner from hours.
- **Autosave**, service radius/geo, break windows, alt-phone/WhatsApp — cut as low-intent.

---

## 8. Decisions (resolved 2026-07-18)

1. **Tiered rich set** (bill-essentials + service/hours + optional §C) — ✅.
2. **Branding & media** (cover, gallery ≤8, socials, brand colour, tagline) — ✅ added (§D).
3. **Service options → POS order-type buttons** — ✅.
4. **FSSAI No. + legal entity name on the invoice** — ✅ (tagline NOT printed, per staff).
5. **FSSAI expiry warning** in settings — ✅.
6. **Business hours** (weekly, Json) — ✅.
