import { getStaffSession } from "@/lib/staff-session";
import { findStaffById } from "@/repositories/staff.repository";
import type { StaffRole } from "@/types/staff";

export interface StaffContext {
  readonly staffId: string;
  readonly restaurantId: string;
  readonly role: StaffRole;
  readonly name: string;
  readonly employeeCode: string;
}

/**
 * Resolve the signed-in staff member, re-checking the DB row on every call so a
 * deactivated / deleted / role-changed staff member is locked out immediately.
 * Also enforces that the session's restaurant still matches the staff record.
 */
export const getStaffContextOrNull = async (): Promise<StaffContext | null> => {
  const session = await getStaffSession();
  if (!session) {
    return null;
  }
  const staff = await findStaffById(session.staffId);
  if (
    !staff ||
    staff.deletedAt ||
    staff.status !== "ACTIVE" ||
    (staff.role !== "WAITER" && staff.role !== "KITCHEN") ||
    staff.restaurantId !== session.restaurantId
  ) {
    return null;
  }
  return {
    staffId: staff.id,
    restaurantId: staff.restaurantId,
    role: staff.role,
    name: staff.name,
    employeeCode: staff.employeeCode,
  };
};
