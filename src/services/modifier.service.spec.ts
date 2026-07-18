import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { ModifierGroupWithModifiers } from "@/repositories/modifier-group.repository";

vi.mock("@/repositories/modifier-group.repository", () => ({
  createModifierGroup: vi.fn(),
  findModifierGroupById: vi.fn(),
  findModifierGroupsByRestaurant: vi.fn(),
  softDeleteModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
}));

import {
  createModifierGroup,
  findModifierGroupById,
} from "@/repositories/modifier-group.repository";
import {
  createGroup,
  mapModifierGroup,
  MENU_FORBIDDEN,
  updateGroup,
} from "./modifier.service";

const makeGroup = (
  overrides: Partial<ModifierGroupWithModifiers> = {},
): ModifierGroupWithModifiers => ({
  id: "g1",
  restaurantId: "res_1",
  name: "Milk",
  minSelect: 1,
  maxSelect: 1,
  isRequired: false,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  modifiers: [
    {
      id: "m1",
      groupId: "g1",
      name: "Oat milk",
      priceDelta: new Prisma.Decimal(30),
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  ...overrides,
});

describe("modifier.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createGroup delegates to the repository", async () => {
    await createGroup("res_1", {
      name: "Milk",
      minSelect: 1,
      maxSelect: 1,
      isRequired: false,
      sortOrder: 0,
      modifiers: [{ name: "Oat", priceDelta: 30, sortOrder: 0, isActive: true }],
    });

    expect(createModifierGroup).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ name: "Milk" }),
    );
  });

  it("updateGroup rejects a group from another restaurant", async () => {
    vi.mocked(findModifierGroupById).mockResolvedValue(
      makeGroup({ restaurantId: "other" }),
    );

    await expect(
      updateGroup("res_1", {
        id: "g1",
        name: "x",
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        sortOrder: 0,
        modifiers: [{ name: "a", priceDelta: 0, sortOrder: 0, isActive: true }],
      }),
    ).rejects.toThrow(MENU_FORBIDDEN);
  });

  it("mapModifierGroup converts Decimal price deltas to numbers", () => {
    const dto = mapModifierGroup(makeGroup());
    expect(dto.modifiers[0].priceDelta).toBe(30);
  });
});
