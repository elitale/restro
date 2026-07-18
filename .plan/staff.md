# Staff (v1)

> Planned with the **buyer** (6 owner personas) and **staff** (5 floor/kitchen personas) agents.
> `/dashboard/staff` — manager adds + manages the restaurant's staff. Layered (UI → Actions → Services → Repositories → DB), TDD-first.
> **Status: SHIPPED (2026-07-19).** POS PIN (no staff login) ✅ · salary/bank/Aadhaar cut ✅ · attribution deferred to v1.1 ✅. Schema→repo→service→action→UI all landed; sidebar wired; tsc + eslint + 289 tests green.

---

## 0. TL;DR — what the agents changed (both panels unanimous)

- **"Password" → a 4-digit POS PIN, NOT a staff login.** 6/6 owners + 5/5 staff: employee-ID+password logins never survive a rush — everyone shares one open terminal, which also makes attribution fake. **Staff do not get their own login in v1;** the owner/manager phone-OTP stays the only real login. Full staff login + RBAC → deferred (only a multi-outlet chain truly needs it, managers-only). **Employee ID = an internal reference, never a login credential.**
- **Cut salary / bank account / Aadhaar-PAN from v1.** 0–1/6 owners will type these into a POS app; it's a liability magnet and staff distrust it. If ever added: a separate, permission-gated, masked (last-4), encrypted module — never on the POS/KDS surface.
- **Attribution is the #1 value** (who voided/comped/discounted, which server owns an order/tab) — but it's a **POS/orders integration** (PIN-stamped, zero extra taps). Scoped as the **recommended v1.1 follow-up**, not this build. This screen is the manager back-office directory that makes attribution possible.
- **Keep it fast + lean:** <30s to add a person; long HR forms die. Photo is genuinely useful (face for handover). Sensitive HR lives in this manager-only back-office, never the floor.

---

## 1. Scope (v1) — staff directory + profiles + POS PIN

**In**
- **Staff CRUD** at `/dashboard/staff`, grouped by role, with a manager-only back-office profile.
- **Fields:**
  - Core (required): **employee code** (unique per restaurant), **name**, **role** (Waiter / Kitchen / Management), **phone**, **status** (Active / On-leave / Inactive), **PIN** (set on create).
  - Profile photo (upload/remove, reuse the image pipeline).
  - Contact (optional): email, address (line1/2, city, state, PIN), emergency contact (name + phone).
  - Employment (optional): joining date, employment type (Full-time / Part-time / Contract).
  - Personal (optional): date of birth, gender.
  - notes (optional).
- **PIN** stored **hashed** (never returned/rendered), unique per restaurant → identifies exactly one staff (ready for attribution). Reset-PIN action.
- Sidebar **Staff → `/dashboard/staff`**.

**Deferred (explicitly out)**
- **Full staff login + role-based access control (RBAC)** — waiter→POS-only, kitchen→KDS, etc. PIN covers v1; only a paying multi-outlet customer forces real RBAC.
- **Salary / wage, bank account, Aadhaar / PAN** — liability; keep in Excel/payroll tools.
- **Order/void/comp attribution** (PIN-stamped `staffId` on orders + reports) — the recommended **next** feature; touches the whole POS/orders flow.
- Attendance / clock-in-out / shifts / rosters, payroll, permissions matrix, document uploads, staff self-service.

---

## 2. Data model

```prisma
enum StaffRole {
  WAITER
  KITCHEN
  MANAGEMENT
}

enum StaffStatus {
  ACTIVE
  ON_LEAVE
  INACTIVE
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

model Staff {
  id                    String          @id @default(cuid())
  restaurantId          String
  employeeCode          String
  name                  String
  role                  StaffRole
  status                StaffStatus     @default(ACTIVE)
  photoUrl              String?
  phone                 String
  email                 String?
  addressLine1          String?
  addressLine2          String?
  city                  String?
  state                 String?
  postalCode            String?
  dateOfBirth           DateTime?
  gender                Gender?
  joiningDate           DateTime?
  employmentType        EmploymentType?
  emergencyContactName  String?
  emergencyContactPhone String?
  notes                 String?
  pinHash               String
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  deletedAt             DateTime?

  restaurant Restaurant @relation(fields: [restaurantId], references: [id])

  @@unique([restaurantId, employeeCode])
  @@index([restaurantId])
}
```

> **Revised 2026-07-19 — PINs are no longer unique.** The original `@@unique([restaurantId, pinHash])` was dropped (migration `staff_shared_pin`) at the owner's request: multiple staff may share the same POS PIN. The `STAFF_PIN_TAKEN` guard and `findStaffByPinHash` lookup were removed. Trade-off accepted: a PIN alone can't identify *who* entered it — revisit if PIN login / per-staff attribution lands in v1.1 (would need a unique PIN or a separate identifier).

- `Restaurant` gains `staff Staff[]`. Migration **`add_staff`** (additive, no reset).
- **PIN hashing** (`lib/staff-pin.ts`): `pinHash = HMAC-SHA256(AUTH_SECRET, "${restaurantId}:${pin}")` — deterministic per (restaurant, PIN), so `@@unique([restaurantId, pinHash])` guarantees no two staff share a PIN **and** enables an O(1) PIN→staff lookup for future attribution. (Mirrors the existing OTP HMAC approach.) PIN is 4–6 digits — inherently low-entropy; it authorizes low-stakes POS actions, **not** money movement. `pinHash` never leaves the server; DTOs carry only `hasPin`.
- Sensitive PII (salary/bank/ID) deliberately **absent** from the schema.

---

## 3. Layers (bottom-up, TDD)

- **Validators** `lib/validators/staff.ts` — `staffRoleSchema`, `createStaffSchema` (employeeCode 1–40, name 1–120, role, phone, status default ACTIVE, `pin` `/^\d{4,6}$/`, optional contact/employment/personal), `updateStaffSchema` (id + editable, **no PIN**), `deleteStaffSchema`, `resetPinSchema` (id + pin). Photo via `FormData`.
- **PIN util** `lib/staff-pin.ts` — `hashStaffPin(pin, restaurantId)`.
- **Repository** `repositories/staff.repository.ts` — `createStaff`, `updateStaff`, `reviveStaff`, `softDeleteStaff`, `findStaffById`, `findStaffByEmployeeCode`, `findStaffByPinHash` (for future attribution), `findStaffByRestaurant`, `updateStaffPin`, `setStaffPhoto`.
- **Service** `services/staff.service.ts` (+ `types/staff.ts` `StaffDTO` — **no pinHash**, `hasPin: boolean`) — `listStaff`, `createStaff` (hash PIN, employee-code + PIN-collision → typed errors, revive soft-deleted code), `updateStaff`, `deleteStaff` (soft), `resetPin`, ownership + `STAFF_*` errors.
- **Photo** `services/staff-image.service.ts` — `uploadStaffPhoto`/`removeStaffPhoto` (sharp→WebP ~512², fixed key `staff/{id}/photo.webp`, reuse `lib/storage.ts`).
- **Actions** `actions/staff.actions.ts` (`withManagerValidation`) + FormData photo actions.
- **Types** `types/staff.ts` — `StaffRole`, `StaffStatus`, `EmploymentType`, `Gender`, `StaffDTO`.

---

## 4. UI — `/dashboard/staff`

- **Header:** PageHeader + **Add staff**. Small counts per role.
- **List** grouped by **role** (Waiter / Kitchen / Management): each row → photo avatar, name, status badge (On-leave/Inactive), phone, employee code, `hasPin` indicator; actions **Edit** / **Reset PIN** / **Remove** (soft, confirm).
- **`staff-dialog`** — create/edit: photo uploader + core fields (code, name, role, phone, status) + collapsible **Contact** / **Employment** / **Personal** optional sections + notes. On create, a **Set PIN** field (masked, 4–6 digits). Mount-while-open.
- **`reset-pin-dialog`** — masked new PIN.
- shadcn Card/Field/Input/Select/Switch/Dialog + `useServerAction` + `sonner`. Manager-only back-office copy; PIN inputs masked; sensitive HR fields absent by design.
- **Sidebar:** add **Staff** entry.

---

## 5. Tests (TDD, co-located `.spec.ts`)

- `staff-pin.spec` — deterministic hash per (restaurant, PIN); different restaurants/PINs differ.
- `staff.repository.spec` — CRUD, soft-delete, list ordering, lookups.
- `staff.service.spec` — create hashes PIN + never leaks it (`hasPin`), employee-code + PIN-collision errors, revive, ownership, resetPin.
- `staff-image.service.spec` — sharp→WebP→putObject; remove.
- `staff.actions.spec` — delegation + `NO_RESTAURANT` + validation (bad PIN, blank code).
- Gate: `tsc --noEmit` + `eslint src` + full `vitest run`, zero failures.

---

## 6. Decisions to confirm

1. **"Password" → a 4-digit POS PIN, not a staff login** (staff don't get their own login; manager stays the only login) — *recommend yes* (6/6 owners + 5/5 staff).
2. **Cut salary / bank account / Aadhaar-PAN** from v1 (liability) — *recommend yes*; keep the rest of the rich profile (photo, address, emergency contact, employment, DOB/gender, notes).
3. **Attribution** (PIN-stamped who-voided / which-server, + reports) — *recommend defer to a focused v1.1* (this build = the directory that enables it). Want a light version now instead?
4. **Employee code** required + unique per restaurant — *recommend yes*.
