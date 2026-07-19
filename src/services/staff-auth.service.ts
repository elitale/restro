import { hashStaffPin } from "@/lib/staff-pin";
import { findRestaurantByUsername } from "@/repositories/restaurant.repository";
import {
  findStaffByEmployeeCode,
  findStaffByRestaurant,
  recordStaffLoginFailure,
  resetStaffLoginCounters,
} from "@/repositories/staff.repository";
import type { StaffRole } from "@/types/staff";

export const STAFF_LOGIN_INVALID = "STAFF_LOGIN_INVALID";
export const STAFF_LOGIN_LOCKED = "STAFF_LOGIN_LOCKED";

export const MAX_STAFF_ATTEMPTS = 5;
export const STAFF_LOCK_MS = 60_000;

export interface StaffLoginResult {
  readonly staffId: string;
  readonly role: StaffRole;
}

export interface StaffLoginRestaurant {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly logoUrl: string | null;
}

/** A selectable staff member on the login screen — never exposes the PIN hash. */
export interface StaffLoginOption {
  readonly employeeCode: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly photoUrl: string | null;
}

/** Public login-page info for a restaurant, resolved from its username. */
export const getStaffLoginRestaurant = async (
  username: string,
): Promise<StaffLoginRestaurant | null> => {
  const restaurant = await findRestaurantByUsername(username);
  if (!restaurant || restaurant.deletedAt || !restaurant.isActive) {
    return null;
  }
  return {
    id: restaurant.id,
    name: restaurant.name,
    username: restaurant.username ?? username,
    logoUrl: restaurant.logoUrl,
  };
};

/** Active waiter/kitchen staff who can sign in, for the login picker. */
export const listLoginStaff = async (
  restaurantId: string,
): Promise<StaffLoginOption[]> => {
  const staff = await findStaffByRestaurant(restaurantId);
  return staff
    .filter(
      (s) =>
        s.status === "ACTIVE" && (s.role === "WAITER" || s.role === "KITCHEN"),
    )
    .map((s) => ({
      employeeCode: s.employeeCode,
      name: s.name,
      role: s.role,
      photoUrl: s.photoUrl,
    }));
};

/**
 * Verify a staff member's Employee ID + PIN for a restaurant. Only ACTIVE
 * waiter/kitchen staff may sign in. Failures are generic (`STAFF_LOGIN_INVALID`)
 * to avoid enumeration; a locked account throws `STAFF_LOGIN_LOCKED`.
 */
export const verifyStaffLogin = async (
  restaurantId: string,
  employeeCode: string,
  pin: string,
): Promise<StaffLoginResult> => {
  const staff = await findStaffByEmployeeCode(restaurantId, employeeCode);
  if (!staff || staff.deletedAt || staff.status !== "ACTIVE") {
    throw new Error(STAFF_LOGIN_INVALID);
  }
  if (staff.role !== "WAITER" && staff.role !== "KITCHEN") {
    throw new Error(STAFF_LOGIN_INVALID);
  }
  if (staff.loginLockedUntil && staff.loginLockedUntil.getTime() > Date.now()) {
    throw new Error(STAFF_LOGIN_LOCKED);
  }
  if (hashStaffPin(pin, restaurantId) !== staff.pinHash) {
    const failedAttempts = staff.loginFailedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_STAFF_ATTEMPTS
        ? new Date(Date.now() + STAFF_LOCK_MS)
        : null;
    await recordStaffLoginFailure(staff.id, { failedAttempts, lockedUntil });
    throw new Error(STAFF_LOGIN_INVALID);
  }
  await resetStaffLoginCounters(staff.id);
  return { staffId: staff.id, role: staff.role };
};
