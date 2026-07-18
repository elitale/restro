# Manager Sign-in PIN (v1)

> `/dashboard/settings` — a manager sets a numeric **sign-in PIN** so repeat logins skip the SMS OTP.
> Layered (UI → Actions → Services → Repositories → DB), TDD-first. Additive migration only.
> **Status: SHIPPED (2026-07-19).** Schema→lib→repo→service→actions→UI landed; migration `add_manager_pin`; tsc + eslint + 319 tests green. Phone-first routing, scrypt hashing, per-user lockout, Settings card, login PIN step all live.

---

## 0. Locked decisions (confirmed with the owner, 2026-07-19)

| Decision | Choice | Notes |
|---|---|---|
| **Acceptance model** | **Phone + PIN from anywhere** | Enter phone + PIN on *any* device, no OTP. (Owner picked this over device-bound.) |
| **PIN length** | **4–6 digits** | `^\d{4,6}$`. UI nudges toward 6. |
| **Change / remove** | **No re-auth** | Any signed-in session can set/change/remove the PIN (they're already authenticated). |
| **OTP** | **Stays** | PIN is an *alternative* login, never a replacement. **Forgot PIN → OTP** is an explicit login-screen affordance (§9b); lockout also forces OTP. |
| **Login routing** | **Phone-first, automatic** | Enter phone → if that phone has a PIN, ask for the **PIN**; if not, send **OTP** automatically. **No "choose a method" screen.** |

> ⚠️ **Security note (read before building).** "Phone + PIN from anywhere" means a **known phone number + a guessed/shoulder-surfed 4–6 digit PIN = full account access**, with no possession factor. Phones are semi-public and a 4-digit PIN is 10⁴ guesses. This plan therefore **mandates** the compensating controls in §2 — they are not optional. If they're ever weakened, this becomes an OWASP A07 (authentication failure) hole. Recommended future upgrade in §12.

---

## 1. Current auth (what we're extending)

- **Login:** phone → OTP. `requestOtp` (Twilio SMS, 6-digit, HMAC-hashed via `AUTH_SECRET`, 5-min TTL, 5 attempts, 30s resend) → `verifyOtp` returns `userId` → `createSession(userId)` sets `restro_session` (jose HS256 JWT, httpOnly, sameSite=lax, **30-day**).
- **Proxy** (`src/proxy.ts`): optimistic — only checks the session cookie *presence*; never verifies JWT or hits the DB.
- **User** = manager account. `phone` unique (primary id), `email?`, `role`, `isActive`, `suspendedAt?`, `deletedAt?`.
- **Current user id:** `getCurrentUserId()` / `requireUserId()` (`src/lib/auth-helpers.ts`) read the session. Manager+restaurant via `getManagerContextOrNull()`.
- **Hashing today:** `lib/otp.ts` = `HMAC-SHA256(AUTH_SECRET)` (fast, unsalted — fine for short-lived OTP, **not** for a long-lived PIN → see §3).

---

## 2. Security hardening (MANDATORY compensating controls)

Because the model is phone+PIN-anywhere, these are the whole defense:

1. **Per-user lockout.** Track `pinFailedAttempts` + `pinLockedUntil` on `User`. After **5** consecutive wrong PINs → lock the PIN path for **15 min** (`PIN_LOCKED`), forcing OTP. Successful PIN or successful OTP login resets the counter.
2. **Slow, salted hashing.** Store the PIN with **scrypt + random per-user salt** (`node:crypto`, zero new deps), constant-time compare. A DB leak must not trivialise PIN recovery. (See §3.)
3. **Generic PIN-verification failures.** A wrong PIN always surfaces one message: *"Incorrect PIN."* — never which field was wrong or how many tries remain (internally `PIN_INVALID` vs `PIN_LOCKED` drives the lockout hint). **Known enumeration tradeoff:** the phone-first router (§9b) reveals whether a *registered* phone has a PIN (you land on the PIN step vs the OTP step), and the phone step still shows the pre-existing *"not registered"* message. Accepted: registration is already disclosed by today's OTP flow, and the added PIN-presence signal is bounded by the lockout + slow hash. Revisit with device-binding (§12) if enumeration becomes a concern.
4. **Eligibility re-checked every login.** `deletedAt` / `suspendedAt` / `isActive=false` → treated as generic invalid (same as OTP path).
5. **OTP always available as fallback**, and the *only* path once locked.
6. **Opt-in.** PIN login only works for users who have explicitly set one (`pinHash != null`).
7. **Session parity.** PIN login issues the exact same 30-day `restro_session` — no elevated/reduced scope.
8. **(v1.1, recommended) SMS alert on PIN sign-in** + **device binding** (§12).

---

## 3. `lib/pin.ts` — hashing (new)

scrypt via `node:crypto`, self-describing string `scrypt$<saltHex>$<hashHex>`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const hashPin = (pin: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
};

export const verifyPin = (pin: string, stored: string): boolean => {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = scryptSync(pin, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};
```

- **Not** the deterministic HMAC used for staff PINs — a login PIN needs a per-user salt + slow KDF (no lookup-by-hash required here; we resolve the user by phone).
- `scryptSync` is fine for login volume; swap to async `scrypt` if it ever shows up in profiling.

---

## 4. Data model (additive migration `add_manager_pin`)

Add to `model User`:

```prisma
  pinHash           String?
  pinUpdatedAt      DateTime?
  pinFailedAttempts Int       @default(0)
  pinLockedUntil    DateTime?
```

- All nullable / defaulted → **additive, safe**. No `TrustedDevice` table in v1 (that's the device-bound upgrade, §12).
- **Never** hard-reset the DB; `prisma migrate dev --name add_manager_pin` then generate.

---

## 5. Validators (`lib/validators/auth.ts` additions)

```ts
export const managerPinSchema = z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4–6 digits");
export const setPinSchema    = z.object({ pin: managerPinSchema });
export const verifyPinSchema = z.object({ phone: phoneSchema, pin: managerPinSchema });
```

Client dialog also enforces a **confirm-PIN** re-entry (not sent to the server).

---

## 6. Repository (`user.repository.ts` additions)

- `setUserPin(userId, pinHash)` → set `pinHash`, `pinUpdatedAt=now`, reset `pinFailedAttempts=0`, `pinLockedUntil=null`.
- `clearUserPin(userId)` → null `pinHash`/`pinUpdatedAt`, reset counters.
- `recordPinFailure(userId, { failedAttempts, lockedUntil })`.
- `resetPinCounters(userId)`.
- (reuse existing `findUserByPhone`, add `findUserById` if missing.)

---

## 7. Service (`services/pin-auth.service.ts` — new)

Error consts: `PIN_INVALID`, `PIN_LOCKED`. Tunables: `MAX_PIN_ATTEMPTS = 5`, `LOCK_WINDOW_MS = 15 * 60_000`.

- `setManagerPin(userId, pin)` → `hashPin` → `setUserPin`.
- `removeManagerPin(userId)` → `clearUserPin`.
- `getPinStatus(userId)` → `{ hasPin: boolean; pinUpdatedAt: string | null }` (for the settings card).
- `verifyPinLogin(phone, pin): Promise<string>` (returns userId):
  1. `findUserByPhone`; if missing/ineligible/`pinHash==null` → **`PIN_INVALID`** (generic, no enumeration).
  2. If `pinLockedUntil > now` → **`PIN_LOCKED`**.
  3. `verifyPin` fails → `recordPinFailure` (increment; if `>= MAX` set `pinLockedUntil = now + LOCK_WINDOW`) → **`PIN_INVALID`**.
  4. Success → `resetPinCounters` → return `user.id`.

### 7b. Login routing (`auth.service.ts`)
`startLogin(phone): Promise<"pin" | "otp">` — the single entry point after the phone step:
1. `findEligibleUser(phone)` → not registered/ineligible ⇒ throw `OTP_USER_NOT_FOUND` (form shows "not registered", as today).
2. `user.pinHash != null` **and** not locked (`pinLockedUntil <= now`) ⇒ return `"pin"` (**no SMS sent**).
3. Otherwise (no PIN, or PIN locked) ⇒ `requestOtp(phone)` (swallow `OTP_RATE_LIMITED` — a recent code is still valid) ⇒ return `"otp"`.

Reads `pinHash`/`pinLockedUntil` off the already-fetched `User` (no cross-service import; lives beside `requestOtp`).

---

## 8. Actions (`actions/auth.actions.ts` / new `actions/pin.actions.ts`)

- `startLoginAction` — **public**, `withValidation(requestOtpSchema, …)` (input `{ phone }`) → `startLogin(phone)` → `ActionResult<{ method: "pin" | "otp" }>`. When it returns `"otp"` the code has **already been sent**. `OTP_USER_NOT_FOUND` → failure (form shows "not registered").
- `setPinAction` — `getCurrentUserId()` (401→`failure("NO_SESSION")`), validate `setPinSchema`, `setManagerPin`. `ActionResult<void>`.
- `removePinAction` — authed, `removeManagerPin`.
- `verifyPinAction` — **public**, `withValidation(verifyPinSchema, …)` → `verifyPinLogin` → `createSession(userId)`. Map `PIN_LOCKED`→lockout copy, everything else→generic copy.
- **Forgot PIN** reuses the existing `requestOtpAction({ phone })` (no new action).
- (OTP verify path unchanged. Reset PIN counters on a successful OTP login.)

---

## 9. UI

### 9a. Settings — "Sign-in PIN" card (`components/settings/sign-in-pin-card.tsx`)
- Manager-only (page already gates on `getManagerContextOrNull`). Page fetches `getPinStatus(userId)` and passes `hasPin` + `pinUpdatedAt`.
- **No PIN:** "Set a PIN" → `pin-dialog` (PIN + confirm, masked, 4–6 digits, "6 recommended").
- **Has PIN:** "PIN enabled · updated {date}", buttons **Change PIN** / **Remove PIN** (remove = confirm dialog). No current-PIN prompt (locked decision).
- `useServerAction` + toast + `router.refresh()`.
- Copy sets expectations honestly: *"Sign in with your phone number and this PIN, skipping the SMS code. Keep it secret."*

### 9b. Login — phone-first auto-routing (`components/login-form.tsx`)
No "choose a method" screen. Three steps; the router decides step 2:

1. **Phone** — enter phone → `startLoginAction({ phone })`:
   - `{ method: "pin" }` → go to **PIN** step.
   - `{ method: "otp" }` → OTP already sent → go to **Code** step (today's default flow).
   - `OTP_USER_NOT_FOUND` → inline *"This phone number isn't registered…"* (unchanged).
2. **PIN** (only when a PIN is set) — masked 4–6 digit input → `verifyPinAction({ phone, pin })`, `redirectTo:/dashboard`.
   - Prominent **"Forgot PIN? Sign in with a code instead"** → calls `requestOtpAction({ phone })` → **Code** step.
   - Wrong PIN → generic *"Incorrect PIN."*; `PIN_LOCKED` → *"Too many attempts. Use a one-time code."* + auto-send OTP + jump to **Code** step.
3. **Code** — existing 6-digit OTP step → `verifyOtpAction` → `/dashboard`. "Change number" returns to step 1.

- Phone is carried across all steps (no retype).
- **Cleanup while here:** remove the stray `useEffect(() => console.log({error}))` debug block in `login-form.tsx`.

### 9c. Proxy
- Unchanged — PIN login sets the same `restro_session` cookie the proxy already checks.

---

## 10. Build order (bottom-up, TDD — write `.spec.ts` first)

1. **Schema** `add_manager_pin` + migrate + generate.
2. **`lib/pin.ts`** (+ `pin.spec.ts`: roundtrip, wrong pin, tampered/blank stored, unique salts).
3. **`user.repository.ts`** additions (+ spec).
4. **`pin-auth.service.ts`** (+ spec: set hashes+resets, verify success resets, wrong increments, lockout at MAX, locked rejects, unknown/ineligible/no-pin → generic, suspended/deleted rejected).
5. **Validators** (+ reuse existing auth spec patterns).
6. **Actions** (+ spec: `setPinAction` needs session, `verifyPinAction` success creates session, invalid→generic, lockout surfaces; mock `@/lib/auth-helpers`, `@/lib/session`, `@/services/pin-auth.service`).
7. **UI**: settings card + `pin-dialog` + login PIN path.
8. `npx tsc --noEmit && npx eslint src && npx vitest run`; restart dev; smoke `/dashboard/settings` + `/login`.
9. Update `.plan/manager-pin-login.md` → SHIPPED + `MEMORY.md` auth section.

---

## 11. Test matrix (key cases)

- Hash: verify true/false; blank & malformed `stored` → false; two hashes of same pin differ (salt).
- Lockout: 5th wrong sets `pinLockedUntil`; 6th → `PIN_LOCKED`; after window, allowed again; success mid-streak resets counter.
- Routing (`startLogin`): has-PIN + unlocked → `"pin"` and **no** OTP sent; no-PIN → `"otp"` + OTP sent; PIN-locked → `"otp"` + OTP sent; unknown/ineligible → `OTP_USER_NOT_FOUND`; `OTP_RATE_LIMITED` swallowed → still `"otp"`.
- Enumeration: `verifyPinLogin` throws the **same** `PIN_INVALID` for unknown phone, ineligible user, and no-PIN user (the *router* is the intentional, accepted PIN-presence reveal — §2.3).
- Action: `verifyPinAction` maps `PIN_LOCKED` vs generic and sets a session only on success.

---

## 12. Residual risk & future upgrade (document, don't silently fix)

- **Residual risk (accepted by owner):** phone+PIN-anywhere has no possession factor; lockout + slow hash + generic errors are the mitigations, but a determined attacker who knows a phone can still attempt (throttled) guesses and shoulder-surfing/credential-reuse is fully effective.
- **Recommended v1.1 upgrades (keep code modular so these drop in):**
  1. **Device binding** — issue a long-lived `restro_device` token at OTP login; only accept PIN on an enrolled device. Converts this to true 2-factor (device + PIN). *(This was the recommended model; revisit.)*
  2. **SMS alert on PIN sign-in** (reuse Twilio) — "You signed in with your PIN at …".
  3. **IP/global throttle** on `verifyPinAction` (beyond per-user lockout) to blunt distributed guessing.
  4. Optional **require current PIN** to change/remove.

---

## 13. Out of scope (v1)

- Staff/POS PIN login (separate — staff PINs are non-unique, not logins).
- Biometric / WebAuthn / passkeys.
- Trusted-device management UI (ships with §12.1).
- **Dedicated forgot-PIN reset flow** — not needed: OTP *is* the recovery path (explicit "Forgot PIN?" link on login → sign in with a code → change/remove PIN in Settings).
