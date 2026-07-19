# Plan: Self-order page — verified badge, photo carousel, my-orders + status

> Plan-first. Status: **SHIPPED 2026-07-20** — decisions locked (§6), built bottom-up TDD. Suite 474 green · tsc/eslint clean · `next build` ✓.

---

## 1. Goals (guest page `/order/[username]?table=…`)

1. **Verified badge** once the guest's phone is verified.
2. **Menu item photos**, with a **carousel** when an item has multiple pictures.
3. **"Your orders"** — the guest can see their own past/active orders **and each order's live status**.

---

## 2. What already exists (reuse)

- **Images already reach the client:** `getMenu()` → `MenuItemDTO.images[] { id, url, isPrimary }`. The guest page just doesn't render them yet. Image URLs are absolute (Supabase) and already allowed by `next.config.ts`, so `next/image` works.
- **Verified state** is already tracked in `GuestOrderPage` (`verified` from the `restro_guest` cookie + localStorage marker).
- **Status derivation** exists: `deriveKitchenStatus()` + shared `KitchenStatusBadge` (Waiting / Preparing / Ready).
- **Live-refresh pattern** exists: server component fetches + client polls via `router.refresh()` every 10s (KDS / waiter / manager). The guest page is already a dynamic server component reading the cookie.
- **No carousel component** in `components/ui` (no embla). **No order-by-phone repository query** yet.

---

## 3. Feature A — Verified badge

- In `GuestOrderPage` header (next to "Ordering for T1"), show a small **"✓ Verified"** pill when `verified` is true.
- Optionally show the masked phone (e.g. "✓ ••210") — see §6 Q1.
- Pure UI; no backend.

---

## 4. Feature B — Menu photos + carousel

**Menu list (guest):**
- Render each item's **primary photo** as a thumbnail in the row.
- The shared `MenuBrowser` is also used by the **waiter** builder; to avoid changing the dense waiter list, add an **opt-in `showImages` prop** (guest passes it), or a thin guest-specific list — see §6 Q2/Q3.

**Item detail + carousel:**
- Photos with multiple pictures need a sw, so tapping an item opens a **detail view** showing a **carousel** (photo 1..N with dot indicators + swipe), the description, then the existing variant/modifier/qty/note controls and **Add**.
- Today, only items *with options* open a dialog; simple items quick-add. Decision needed on whether every item opens a photo detail vs. keeping quick-add — see §6 Q2.
- **Carousel tech:** lightweight CSS scroll-snap + dots (no dependency) vs. add `embla-carousel-react` (shadcn) — see §6 Q3. Recommended: scroll-snap (no dep, touch-native).
- Renders via `next/image`; shows nothing when an item has no photos; shows a static image (no dots) for a single photo; carousel only when 2+.

---

## 5. Feature C — "Your orders" + live status

**Data (secure, phone-scoped):**
- New repo query `findOrdersByRestaurantAndPhone(restaurantId, phone, limit)` (recent first).
- New service `getGuestOrders(restaurantId, phone)` → slim `GuestOrderSummaryDTO[]` (id, orderNumber, createdAt, orderType, tableLabel, status, kitchenStatus, itemCount, grandTotal, line summaries).
- The **page** reads the `restro_guest` cookie (already does) and, when verified, fetches the guest's orders **server-side** and passes them to `GuestOrderPage`. The client **polls `router.refresh()` every 10s** so status changes (Preparing → Ready → Served/Paid) appear live.
- **Security:** only orders whose `customerPhone` == the cookie's verified phone (+ matching `restaurantId`) are ever returned — the client never supplies the phone, so no enumeration.
- **Scope caveat:** orders the guest *created* carry their phone; items they *appended* to a waiter-opened table order don't. Scope options in §6 Q4 (phone-history vs. this-table vs. both).

**UI:**
- A **"Your orders (N)"** entry (header button or section) that opens a **sheet** listing each order: number/time, item summary, total, and a **status badge** (Waiting / Preparing / Ready / Served / Paid). Live-updates on each 10s refresh. See §6 Q5.
- Requires verification (uses the cookie). If not verified, the section is hidden or prompts to verify.

---

## 6. Decisions (locked 2026-07-20)

1. **Verified badge:** → **"✓ Verified" + masked phone** (e.g. "✓ ••210"). Page masks the cookie phone server-side and passes only the masked suffix.
2. **Photo layout / tap:** → **photo card + "+" button**; the **"+"** quick-adds (or opens the configurator for items with options), and **tapping the card opens the detail** (carousel + description + options + Add). The detail view = the existing `ItemConfigDialog`, enhanced with a carousel + description.
3. **Carousel tech:** → **embla** (`embla-carousel-react`) via a small `components/shared/image-carousel.tsx` (swipe + dots + `next/image`).
4. **My-orders scope:** → **both phone + table** — orders where `customerPhone` == verified phone **OR** `tableId` == the session table, this restaurant, most recent first (cap ~15). **PII-safe:** the summary DTO excludes phone/name/address (a table match could otherwise expose a previous occupant's number).
5. **My-orders surface:** → **"Your orders (N)" button → sheet** with per-order **item lines** + a **status badge**, polled live every **10s** via a dedicated `guestMyOrdersAction` (reads the cookie; no menu re-fetch).
6. **Waiter menu:** → **photos on the waiter builder too** — the enhanced `MenuBrowser` (shared by guest + waiter) gets the photo-card + "+" + tap-detail treatment.

Build proceeds bottom-up.
