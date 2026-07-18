import { findFirstRestaurantByOwner } from "@/repositories/restaurant.repository";

import { getCurrentUserId } from "./auth-helpers";

export interface ManagerContext {
  readonly userId: string;
  readonly restaurantId: string;
}

/**
 * Resolve the signed-in manager and their (single, v1) restaurant. Returns null
 * if there's no session or the user owns no restaurant yet.
 */
export const getManagerContextOrNull =
  async (): Promise<ManagerContext | null> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }
    const restaurant = await findFirstRestaurantByOwner(userId);
    if (!restaurant) {
      return null;
    }
    return { userId, restaurantId: restaurant.id };
  };
