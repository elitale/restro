# Staff Login — Waiter & Kitchen (v1)

> A restaurant-scoped login at **`/u/[username]/login`** where **waiter** and **kitchen** staff sign in with **Employee ID + PIN** and get their own session (separate from the manager).
> Layered (UI → Actions → Services → Repositories → DB), TDD-first. Additive migration only.
> **Status: SHIPPED (2026-07-19).** Schema→repo→service→libs→actions→proxy→UI landed; migration `add_staff_login_lockout`; tsc + eslint + 357 tests green. D1–D6 all as recommended. Landing is the minimal role stub (POS/KDS = fast-follow, §8).
> Planned with the **buyer** (6 owners) and **staff** (5 floor/kitchen) agents — see §1.

---

## 0. TL;DR

- New public page `/u/[username]/login` (username = the restaurant's unique handle). Resolves the restaurant, then authenticates a **waiter** or **kitchen** staff member by **Employee ID + PIN**.
- Success ⇒ a **separate staff session** (`restro_staff` cookie: `{ staffId, restaurantId, role }`), then land on `/u/[username]` (a staff home).
- Manager phone-OTP login (`/login`) is untouched. `MANAGEMENT` staff can't use this login.
- Reuses existing pieces: `Restaurant.username` (unique), `Staff` (employeeCode unique per restaurant, `hashStaffPin(pin, restaurantId)`, role, status), and mirrors the manager `restro_session`/proxy pattern.

---

## 1. What the agents said (condensed)

**Loud consensus across both panels:**
1. **A login with no destination is worthless / negative value.** Do NOT ship an empty "you're logged in" landing. Waiter → order-taking; kitchen → KDS. *(This is the biggest scope tension — see D2.)*
2. **Instant deactivation is a must-have.** Fire someone → their PIN + live session die immediately, not "next deploy."
3. **The public URL must not leak the staff roster** and must be **brute-force throttled** (a bare 4-digit PIN + known Employee ID = 10k guesses).
4. **Cross-restaurant scoping is mandatory** — a `spice12` credential/session must be meaningless at another restaurant's URL.
5. **Nobody types `/u/username/login` per shift.** The manager types it once; devices get **provisioned once** (bookmark / home-screen PWA / kiosk) and boot to a PIN pad.

**Staff-agent divergences from the brief (important):**
- **Employee IDs are unknown to floor/kitchen staff.** They want **pick-your-name (tile/photo) → PIN**, not an ID field. *(But a public name grid leaks the roster — buyer's #3. Reconciled in D1.)*
- **Shared tablet ⇒ station stays logged in**; re-tap PIN only for sensitive actions (fire/void/close). Forced logout between tickets = abandoned.
- **Kitchen prefers NO personal login** — the pass is an always-on station, gloves + bump bar. Personal PIN is a floor concept.

**Buyer-agent divergences:**
- **Shared, low-entropy PINs destroy accountability** for comps/voids/oversells — the main reason a suspicious owner wants logins. Fine dining (Sofia) is a soft *no* until money-actions use **unique** PINs.
- Cut: biometrics, SSO/2FA/email for floor staff, geofencing/device-registration, per-role dashboards, self-signup, management login.

---

## 2. Decisions

### Locked (from you)
| # | Decision |
|---|---|
| L1 | URL is **`/u/[username]/login`**, scoped by the restaurant's unique username. |
| L2 | Credentials are **Employee ID + PIN**. |
| L3 | **Waiter and kitchen** staff can log in here. (`MANAGEMENT` excluded; manager still uses `/login` OTP.) |

### Open — please verify before I build
| # | Question | Recommendation |
|---|---|---|
| **D1** | **Credential UX.** Agents want a **name/photo grid → PIN** (staff don't know Employee IDs), but that **leaks the staff roster** on a public URL (buyer's top security worry). Employee ID + PIN (as you asked) leaks nothing. | **UPDATED 2026-07-19 — now a staff picker.** Shipped Employee ID + PIN first, then (per your follow-up) switched the login to a **name/photo picker → PIN pad**: the login page lists ACTIVE waiter/kitchen staff (`listLoginStaff`), tapping one supplies its `employeeCode` behind the scenes (login action/service contract unchanged). **Accepted tradeoff:** the waiter/kitchen roster (names/photos) is now visible on the public `/u/[username]/login`. Harden later with device provisioning if needed. |
| **D2** | **Landing / destination.** Both panels: login without POS/KDS is worthless. Full waiter-POS + kitchen-KDS is a large separate build. | **Ship login + a minimal, honest role landing** (name, role, shift status, logout) **as the auth foundation**, and treat **waiter-POS + kitchen-KDS as the immediate fast-follow** (reuse the existing `/dashboard/pos` + orders behind a staff session). I'll flag in the UI that the work floor is "coming next" rather than pretend it's done. *If you'd rather, we hold this login until the KDS/POS exists.* |
| **D3** | **Brute-force lockout.** Buyer wants throttling; staff must not be stranded mid-rush. | Add **short-cooldown** lockout to `Staff` (`loginFailedAttempts`, `loginLockedUntil`): 5 wrong PINs → **60-second** cooldown (kills brute force, doesn't strand). Additive migration. |
| **D4** | **Session length.** | **Shift-length: 12h absolute**, `restro_staff` httpOnly cookie. Re-login after. (Re-auth-for-sensitive-actions is a v1.1 concern with POS.) |
| **D5** | **Kitchen login.** You want kitchen in; agents say kitchen prefers a station (no personal login). | **Keep kitchen in v1** per your ask; note station-mode/KDS-always-on as a v1.1 option. |
| **D6** | **Shared PIN accountability.** PINs are currently shareable (per your earlier decision). Identity here comes from the **Employee ID**, so login attribution is still unambiguous. | Fine for v1. Revisit **unique PINs** only when money-actions (void/comp) get attributed (buyer/Sofia). Noted, not built. |

---

## 3. Current building blocks (reused)

- **`Restaurant.username`** unique — `findRestaurantByUsername(username)` resolves the URL to a restaurant.
- **`Staff`**: `@@unique([restaurantId, employeeCode])` (so `restaurant + employeeCode` → exactly one staff), `role` (WAITER/KITCHEN/MANAGEMENT), `status` (ACTIVE/ON_LEAVE/INACTIVE), `deletedAt`, `pinHash`.
- **`hashStaffPin(pin, restaurantId)`** (`lib/staff-pin.ts`, deterministic HMAC) — login verifies `hashStaffPin(pin, restaurantId) === staff.pinHash`.
- **Manager session pattern** (`lib/session.ts` jose HS256 + `restro_session` cookie, `proxy.ts` optimistic cookie check) — mirrored for staff.

---

## 4. Architecture (layered)

### 4a. Data (additive migration `add_staff_login_lockout`) — D3
```prisma
model Staff {
  // …existing…
  loginFailedAttempts Int       @default(0)
  loginLockedUntil    DateTime?
}
```

### 4b. Session — `lib/staff-session.ts` (new, mirrors `lib/session.ts`)
- `createStaffSession({ staffId, restaurantId, role })` → jose HS256 JWT (payload holds `restaurantId`, `role`; `sub = staffId`), **`restro_staff`** httpOnly/secure/lax cookie, `maxAge` 12h (D4).
- `getStaffSession()` → verify → `{ staffId, restaurantId, role } | null`.
- `destroyStaffSession()`.
- **Distinct secret domain:** keep `restro_staff` fully separate from `restro_session` (a staff token must never satisfy a manager route, or vice-versa).

### 4c. Auth resolver — `lib/staff-auth.ts` (new)
- `getStaffContextOrNull()`: read `restro_staff` → verify → **re-read the `Staff` row from DB every call** and return null unless **ACTIVE, not deleted, role ∈ {WAITER, KITCHEN}, and `staff.restaurantId === session.restaurantId`**. This gives **instant deactivation** (buyer must-have) and role/scoping enforcement fresh on each request (same philosophy as `admin-auth.ts`).
- `StaffContext = { staffId, restaurantId, role, name, employeeCode }`.

### 4d. Service — `services/staff-auth.service.ts` (new)
- Consts `STAFF_LOGIN_INVALID`, `STAFF_LOGIN_LOCKED`. Tunables `MAX_STAFF_ATTEMPTS = 5`, `STAFF_LOCK_MS = 60_000`.
- `verifyStaffLogin(restaurantId, employeeCode, pin): Promise<{ staffId; role }>`:
  1. `findStaffByEmployeeCode(restaurantId, employeeCode)`; missing / deleted / not ACTIVE / role not in {WAITER,KITCHEN} ⇒ **`STAFF_LOGIN_INVALID`** (generic, no enumeration).
  2. `loginLockedUntil > now` ⇒ **`STAFF_LOGIN_LOCKED`**.
  3. `hashStaffPin(pin, restaurantId) !== pinHash` ⇒ bump `loginFailedAttempts` (≥MAX ⇒ set `loginLockedUntil = now+60s`) ⇒ **`STAFF_LOGIN_INVALID`**.
  4. Success ⇒ reset counters ⇒ return `{ staffId, role }`.
- Repository additions (`staff.repository.ts`): `recordStaffLoginFailure(id, {failedAttempts, lockedUntil})`, `resetStaffLoginCounters(id)`. (`findStaffByEmployeeCode` already exists.)

### 4e. Actions — `actions/staff-auth.actions.ts` (new)
- `staffLoginAction({ username, employeeCode, pin })` — public, `withValidation(staffLoginSchema)`:
  resolve restaurant by username (⇒ `STAFF_LOGIN_INVALID` if unknown/inactive), `verifyStaffLogin`, `createStaffSession`. Returns `ActionResult<{ role }>` (client redirects to `/u/[username]`).
- `staffLogoutAction()` — `destroyStaffSession()` → `redirect("/u/[username]/login")`.

### 4f. Validators — `lib/validators/staff.ts` addition
```ts
staffLoginSchema = z.object({
  username: usernameSchema,                 // reuse from restaurant validators
  employeeCode: z.string().trim().min(1).max(40),
  pin: z.string().trim().regex(/^\d{4,6}$/),
});
```

### 4g. Proxy — `src/proxy.ts` update
- `/u/[username]/login` ⇒ **public**.
- `/u/[username]/**` (non-login) ⇒ require **`restro_staff`** cookie present (optimistic), else redirect to that restaurant's `/u/[username]/login`.
- A present `restro_staff` on `/u/[username]/login` ⇒ redirect to `/u/[username]` (like managers bounced off `/login`).
- Manager `restro_session` does **not** grant `/u/**`; staff `restro_staff` does **not** grant `/dashboard/**`.

### 4h. UI
- **`app/u/[username]/login/page.tsx`** (RSC): `findRestaurantByUsername` → `notFound()` if missing/inactive. Render `StaffLoginForm` with restaurant name/logo.
- **`components/staff-login/staff-login-form.tsx`** (client): **Employee ID** field + a **big numeric PIN pad** (agents: no keyboard, autofocus, ≤3 taps, generic error "Incorrect Employee ID or PIN"). Calls `staffLoginAction`; on success `router.push('/u/'+username)`.
- **`app/u/[username]/page.tsx`** (RSC, staff-gated): `getStaffContextOrNull()` → redirect to login if null; verify URL username maps to `context.restaurantId`. Minimal role landing (name, role, "Log out") + honest "work floor coming next" pointer (D2).
- **`app/u/[username]/layout.tsx`**: shared staff shell (restaurant brand + logout).

---

## 5. Security

- **Instant deactivation** (buyer must-have): `getStaffContextOrNull` re-checks status/role/restaurant **every request** — inactive/deleted/role-changed ⇒ bounced immediately, live session invalidated.
- **No enumeration:** unknown username, unknown Employee ID, wrong PIN, wrong role, inactive → the **same** `STAFF_LOGIN_INVALID`. The login page never lists staff (D1 keeps roster private).
- **Brute-force throttle** (D3): 5 fails → 60s cooldown per staff. Short enough not to strand a rush, lethal to 10k-guess attacks.
- **Cross-restaurant scoping** (buyer must-have): session bound to `restaurantId`; resolver rejects a session whose `restaurantId` ≠ the URL's restaurant.
- **Separate token domain:** `restro_staff` ≠ `restro_session`; neither satisfies the other's routes.
- **Accepted residual (D6):** shared PINs mean the PIN isn't personally identifying, but the **Employee ID is** — so login attribution is unambiguous. Money-action attribution (void/comp) waits for unique PINs.

---

## 6. Build order (bottom-up, TDD — write `.spec.ts` first)

1. Migration `add_staff_login_lockout` (+ generate).
2. `staff.repository` — `recordStaffLoginFailure`, `resetStaffLoginCounters` (+ spec).
3. `services/staff-auth.service.ts` — `verifyStaffLogin` (+ spec: success resets, wrong bumps, lockout at MAX, locked rejects, inactive/deleted/MANAGEMENT/unknown → generic).
4. `lib/staff-session.ts` + `lib/staff-auth.ts` (+ spec for session round-trip + status re-check/scoping).
5. Validators `staffLoginSchema`.
6. `actions/staff-auth.actions.ts` (+ spec: login success sets session, invalid generic, logout clears; mock session + service + `findRestaurantByUsername`).
7. `proxy.ts` update (+ manual reasoning; covered by smoke).
8. UI: login page + PIN-pad form + gated `/u/[username]` landing + layout.
9. `tsc + eslint + vitest`; restart dev; smoke `/u/<username>/login` (200), `/u/<username>` (redirect when no staff cookie).
10. Mark SHIPPED + update `MEMORY.md`.

---

## 7. Test matrix (key cases)

- `verifyStaffLogin`: correct PIN → `{staffId, role}` + counters reset; wrong PIN bumps; 5th → 60s lock; locked → `STAFF_LOGIN_LOCKED`; MANAGEMENT / ON_LEAVE / INACTIVE / deleted / unknown code / unknown username → same `STAFF_LOGIN_INVALID`.
- `getStaffContextOrNull`: valid ACTIVE waiter → context; staff since deactivated/deleted → null (instant deactivation); session `restaurantId` ≠ staff's → null.
- Action: `staffLoginAction` sets session only on success; unknown username → generic; `staffLogoutAction` clears cookie.
- Proxy: `/u/x/login` public; `/u/x` without `restro_staff` → login redirect; manager cookie doesn't grant `/u/**`.

---

## 8. Out of scope (v1) → v1.1+

- **Waiter POS + Kitchen KDS** work screens (the real destination — D2; the biggest fast-follow).
- **Name/photo grid + provisioned-device (kiosk/PWA) unlock** — the ergonomic login staff actually want (D1); needs device trust so the roster isn't public.
- **Station-mode KDS** (always-on, no personal login) for kitchen (D5).
- **Re-auth for sensitive actions** (void/comp/close) + **unique PINs** for money-action accountability (D6).
- **Offline-capable login/PIN check** (staff agent's non-negotiable once the POS exists).
- Fast **user-switch** on a shared station, "who's on this terminal", buddy-punch/attendance, shift clock.
- Management-staff login, self-signup, PIN self-reset (manager resets on the Staff page today).
