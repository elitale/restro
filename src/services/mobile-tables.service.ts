import type { MobileTokenPayload } from "@/lib/mobile-session";
import { findTablesByRestaurant } from "@/repositories/table.repository";

import { MOBILE_ORDER_NO_RESTAURANT } from "./mobile-orders.service";

export interface MobileTableDto {
  readonly id: string;
  readonly label: string;
  readonly seats: number | null;
  readonly section: string | null;
  readonly sortOrder: number;
}

export const listMobileTables = async (
  auth: MobileTokenPayload,
): Promise<{ tables: MobileTableDto[] }> => {
  if (!auth.restaurantId) throw new Error(MOBILE_ORDER_NO_RESTAURANT);
  const rows = await findTablesByRestaurant(auth.restaurantId);
  const tables = rows.map((t) => ({
    id: t.id,
    label: t.label,
    seats: t.seats,
    section: t.section,
    sortOrder: t.sortOrder,
  }));
  return { tables };
};
