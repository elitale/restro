"use server";

import { redirect } from "next/navigation";

import { withValidation } from "@/actions/helpers";
import { createStaffSession, destroyStaffSession } from "@/lib/staff-session";
import { staffLoginSchema } from "@/lib/validators/staff";
import { findRestaurantByUsername } from "@/repositories/restaurant.repository";
import {
  STAFF_LOGIN_INVALID,
  verifyStaffLogin,
} from "@/services/staff-auth.service";
import type { StaffRole } from "@/types/staff";

export const staffLoginAction = withValidation(
  staffLoginSchema,
  async (data): Promise<{ role: StaffRole }> => {
    const restaurant = await findRestaurantByUsername(data.username);
    if (!restaurant || restaurant.deletedAt || !restaurant.isActive) {
      throw new Error(STAFF_LOGIN_INVALID);
    }
    const { staffId, role } = await verifyStaffLogin(
      restaurant.id,
      data.employeeCode,
      data.pin,
    );
    await createStaffSession({ staffId, restaurantId: restaurant.id, role });
    return { role };
  },
);

export const staffLogoutAction = async (username: string): Promise<void> => {
  await destroyStaffSession();
  redirect(`/u/${username}/login`);
};
