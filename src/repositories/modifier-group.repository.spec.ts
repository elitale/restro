import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { modifierGroup: { create, findUnique, findMany, update } },
}));

import {
  createModifierGroup,
  updateModifierGroup,
} from "./modifier-group.repository";

describe("modifierGroupRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createModifierGroup nests modifiers with order", async () => {
    create.mockResolvedValue({ id: "g1" });

    await createModifierGroup("res_1", {
      name: "Milk",
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { name: "Oat milk", priceDelta: 30 },
        { name: "Soy milk", priceDelta: 20 },
      ],
    });

    const arg = create.mock.calls[0][0];
    expect(arg.data.restaurant).toEqual({ connect: { id: "res_1" } });
    expect(arg.data.modifiers.create[0]).toMatchObject({
      name: "Oat milk",
      priceDelta: 30,
      sortOrder: 0,
    });
    expect(arg.data.modifiers.create[1].sortOrder).toBe(1);
  });

  it("updateModifierGroup replaces modifiers wholesale", async () => {
    update.mockResolvedValue({ id: "g1" });

    await updateModifierGroup("g1", { name: "Milk", modifiers: [] });

    expect(update.mock.calls[0][0].data.modifiers).toEqual({
      deleteMany: {},
      create: [],
    });
  });
});
