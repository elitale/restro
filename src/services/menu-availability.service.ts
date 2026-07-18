import type { DisableItemInput } from "@/lib/validators/menu";
import {
  closeDisable,
  createDisable,
  findOpenDisable,
} from "@/repositories/menu-availability.repository";
import { assertItemOwned } from "@/services/menu-item.service";

export const ITEM_ALREADY_DISABLED = "ITEM_ALREADY_DISABLED";
export const ITEM_NOT_DISABLED = "ITEM_NOT_DISABLED";

const isLive = (
  disable: { resumeAt: Date | null },
  now: Date,
): boolean => disable.resumeAt === null || disable.resumeAt > now;

/** 86 an item (manager-only in v1) with a reason and optional auto-return. */
export const disableItem = async (
  restaurantId: string,
  userId: string,
  input: DisableItemInput,
): Promise<void> => {
  await assertItemOwned(restaurantId, input.itemId);

  const existing = await findOpenDisable(input.itemId);
  if (existing && isLive(existing, new Date())) {
    throw new Error(ITEM_ALREADY_DISABLED);
  }

  await createDisable({
    menuItemId: input.itemId,
    reason: input.reason,
    note: input.note ?? null,
    disabledById: userId,
    resumeAt: input.resumeAt ?? null,
  });
};

/** Bring an item back on sale (closes the current open 86). */
export const reenableItem = async (
  restaurantId: string,
  userId: string,
  itemId: string,
): Promise<void> => {
  await assertItemOwned(restaurantId, itemId);

  const open = await findOpenDisable(itemId);
  if (!open) {
    throw new Error(ITEM_NOT_DISABLED);
  }
  await closeDisable(open.id, userId);
};
