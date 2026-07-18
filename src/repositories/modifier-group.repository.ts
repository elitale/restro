import type { ModifierGroup, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const MODIFIER_GROUP_INCLUDE = {
  modifiers: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ModifierGroupInclude;

export type ModifierGroupWithModifiers = Prisma.ModifierGroupGetPayload<{
  include: typeof MODIFIER_GROUP_INCLUDE;
}>;

export interface ModifierWriteData {
  name: string;
  priceDelta: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ModifierGroupWriteData {
  name: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
  sortOrder?: number;
  modifiers: ModifierWriteData[];
}

const modifierCreate = (modifiers: ModifierWriteData[]) =>
  modifiers.map((m, i) => ({
    name: m.name,
    priceDelta: m.priceDelta,
    sortOrder: m.sortOrder ?? i,
    isActive: m.isActive ?? true,
  }));

export const createModifierGroup = (
  restaurantId: string,
  data: ModifierGroupWriteData,
): Promise<ModifierGroupWithModifiers> =>
  prisma.modifierGroup.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      name: data.name,
      minSelect: data.minSelect ?? 0,
      maxSelect: data.maxSelect ?? 1,
      isRequired: data.isRequired ?? false,
      sortOrder: data.sortOrder ?? 0,
      modifiers: { create: modifierCreate(data.modifiers) },
    },
    include: MODIFIER_GROUP_INCLUDE,
  });

export const findModifierGroupById = (
  id: string,
): Promise<ModifierGroupWithModifiers | null> =>
  prisma.modifierGroup.findUnique({
    where: { id },
    include: MODIFIER_GROUP_INCLUDE,
  });

export const findModifierGroupsByRestaurant = (
  restaurantId: string,
): Promise<ModifierGroupWithModifiers[]> =>
  prisma.modifierGroup.findMany({
    where: { restaurantId, deletedAt: null },
    include: MODIFIER_GROUP_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

export const updateModifierGroup = (
  id: string,
  data: ModifierGroupWriteData,
): Promise<ModifierGroupWithModifiers> =>
  prisma.modifierGroup.update({
    where: { id },
    data: {
      name: data.name,
      minSelect: data.minSelect,
      maxSelect: data.maxSelect,
      isRequired: data.isRequired,
      sortOrder: data.sortOrder,
      modifiers: { deleteMany: {}, create: modifierCreate(data.modifiers) },
    },
    include: MODIFIER_GROUP_INCLUDE,
  });

export const softDeleteModifierGroup = (id: string): Promise<ModifierGroup> =>
  prisma.modifierGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

export const findModifierGroupOwnership = (
  id: string,
): Promise<{ restaurantId: string } | null> =>
  prisma.modifierGroup.findUnique({
    where: { id },
    select: { restaurantId: true },
  });
