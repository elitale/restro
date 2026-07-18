import type { Staff } from "@/generated/prisma/client";
import { hashStaffPin } from "@/lib/staff-pin";
import type {
  CreateStaffInput,
  ResetPinInput,
  UpdateStaffInput,
} from "@/lib/validators/staff";
import {
  createStaff as createStaffRepo,
  findStaffByEmployeeCode,
  findStaffById,
  findStaffByPinHash,
  findStaffByRestaurant,
  reviveStaff,
  softDeleteStaff,
  updateStaff as updateStaffRepo,
  updateStaffPin,
  type StaffWriteData,
} from "@/repositories/staff.repository";
import type {
  EmploymentType,
  Gender,
  StaffDTO,
  StaffRole,
  StaffStatus,
} from "@/types/staff";

export const STAFF_NOT_FOUND = "STAFF_NOT_FOUND";
export const STAFF_FORBIDDEN = "STAFF_FORBIDDEN";
export const STAFF_CODE_TAKEN = "STAFF_CODE_TAKEN";
export const STAFF_PIN_TAKEN = "STAFF_PIN_TAKEN";

export interface StaffContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const mapStaff = (s: Staff): StaffDTO => ({
  id: s.id,
  employeeCode: s.employeeCode,
  name: s.name,
  role: s.role as StaffRole,
  status: s.status as StaffStatus,
  photoUrl: s.photoUrl,
  phone: s.phone,
  email: s.email,
  addressLine1: s.addressLine1,
  addressLine2: s.addressLine2,
  city: s.city,
  state: s.state,
  postalCode: s.postalCode,
  dateOfBirth: iso(s.dateOfBirth),
  gender: s.gender as Gender | null,
  joiningDate: iso(s.joiningDate),
  employmentType: s.employmentType as EmploymentType | null,
  emergencyContactName: s.emergencyContactName,
  emergencyContactPhone: s.emergencyContactPhone,
  notes: s.notes,
  hasPin: Boolean(s.pinHash),
});

const toWriteData = (
  input: CreateStaffInput | UpdateStaffInput,
): StaffWriteData => ({
  employeeCode: input.employeeCode,
  name: input.name,
  role: input.role,
  status: input.status,
  phone: input.phone,
  email: input.email ?? null,
  addressLine1: input.addressLine1 ?? null,
  addressLine2: input.addressLine2 ?? null,
  city: input.city ?? null,
  state: input.state ?? null,
  postalCode: input.postalCode ?? null,
  dateOfBirth: input.dateOfBirth ?? null,
  gender: input.gender ?? null,
  joiningDate: input.joiningDate ?? null,
  employmentType: input.employmentType ?? null,
  emergencyContactName: input.emergencyContactName ?? null,
  emergencyContactPhone: input.emergencyContactPhone ?? null,
  notes: input.notes ?? null,
});

export const listStaff = async (restaurantId: string): Promise<StaffDTO[]> =>
  (await findStaffByRestaurant(restaurantId)).map(mapStaff);

const loadOwnedStaff = async (
  restaurantId: string,
  id: string,
): Promise<Staff> => {
  const staff = await findStaffById(id);
  if (!staff || staff.deletedAt) {
    throw new Error(STAFF_NOT_FOUND);
  }
  if (staff.restaurantId !== restaurantId) {
    throw new Error(STAFF_FORBIDDEN);
  }
  return staff;
};

/** Ensure a PIN hash isn't already used by a different active staff member. */
const assertPinFree = async (
  restaurantId: string,
  pinHash: string,
  ownId: string | null,
): Promise<void> => {
  const clash = await findStaffByPinHash(restaurantId, pinHash);
  if (clash && !clash.deletedAt && clash.id !== ownId) {
    throw new Error(STAFF_PIN_TAKEN);
  }
};

export const createStaff = async (
  ctx: StaffContext,
  input: CreateStaffInput,
): Promise<StaffDTO> => {
  const pinHash = hashStaffPin(input.pin, ctx.restaurantId);
  const data = toWriteData(input);
  const existing = await findStaffByEmployeeCode(
    ctx.restaurantId,
    input.employeeCode,
  );
  if (existing && !existing.deletedAt) {
    throw new Error(STAFF_CODE_TAKEN);
  }
  await assertPinFree(ctx.restaurantId, pinHash, existing?.id ?? null);
  if (existing) {
    return mapStaff(await reviveStaff(existing.id, data, pinHash));
  }
  return mapStaff(await createStaffRepo(ctx.restaurantId, data, pinHash));
};

export const updateStaff = async (
  ctx: StaffContext,
  input: UpdateStaffInput,
): Promise<StaffDTO> => {
  const staff = await loadOwnedStaff(ctx.restaurantId, input.id);
  if (input.employeeCode !== staff.employeeCode) {
    const clash = await findStaffByEmployeeCode(
      ctx.restaurantId,
      input.employeeCode,
    );
    if (clash && clash.id !== staff.id && !clash.deletedAt) {
      throw new Error(STAFF_CODE_TAKEN);
    }
  }
  return mapStaff(await updateStaffRepo(staff.id, toWriteData(input)));
};

export const deleteStaff = async (
  ctx: StaffContext,
  input: { id: string },
): Promise<void> => {
  const staff = await loadOwnedStaff(ctx.restaurantId, input.id);
  await softDeleteStaff(staff.id);
};

export const resetPin = async (
  ctx: StaffContext,
  input: ResetPinInput,
): Promise<void> => {
  const staff = await loadOwnedStaff(ctx.restaurantId, input.id);
  const pinHash = hashStaffPin(input.pin, ctx.restaurantId);
  await assertPinFree(ctx.restaurantId, pinHash, staff.id);
  await updateStaffPin(staff.id, pinHash);
};
