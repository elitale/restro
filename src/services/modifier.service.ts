import type {
  CreateModifierGroupInput,
  UpdateModifierGroupInput,
} from "@/lib/validators/menu";
import {
  createModifierGroup,
  findModifierGroupById,
  findModifierGroupsByRestaurant,
  softDeleteModifierGroup,
  updateModifierGroup,
  type ModifierGroupWithModifiers,
} from "@/repositories/modifier-group.repository";
import type { MenuModifierGroupDTO } from "@/types/menu";

export const MODIFIER_GROUP_NOT_FOUND = "MODIFIER_GROUP_NOT_FOUND";
export const MENU_FORBIDDEN = "MENU_FORBIDDEN";

export const mapModifierGroup = (
  group: ModifierGroupWithModifiers,
): MenuModifierGroupDTO => ({
  id: group.id,
  name: group.name,
  minSelect: group.minSelect,
  maxSelect: group.maxSelect,
  isRequired: group.isRequired,
  modifiers: group.modifiers.map((m) => ({
    id: m.id,
    name: m.name,
    priceDelta: Number(m.priceDelta),
  })),
});

const assertOwned = async (
  restaurantId: string,
  id: string,
): Promise<void> => {
  const group = await findModifierGroupById(id);
  if (!group || group.deletedAt) {
    throw new Error(MODIFIER_GROUP_NOT_FOUND);
  }
  if (group.restaurantId !== restaurantId) {
    throw new Error(MENU_FORBIDDEN);
  }
};

export const listModifierGroups = async (
  restaurantId: string,
): Promise<MenuModifierGroupDTO[]> =>
  (await findModifierGroupsByRestaurant(restaurantId)).map(mapModifierGroup);

export const createGroup = async (
  restaurantId: string,
  input: CreateModifierGroupInput,
): Promise<void> => {
  await createModifierGroup(restaurantId, input);
};

export const updateGroup = async (
  restaurantId: string,
  input: UpdateModifierGroupInput,
): Promise<void> => {
  await assertOwned(restaurantId, input.id);
  await updateModifierGroup(input.id, input);
};

export const deleteGroup = async (
  restaurantId: string,
  id: string,
): Promise<void> => {
  await assertOwned(restaurantId, id);
  await softDeleteModifierGroup(id);
};
