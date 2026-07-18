import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findFirst, update, findMany } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItemAvailability: { create, findFirst, update, findMany },
  },
}));

import {
  closeDisable,
  createDisable,
  findOpenDisable,
} from "./menu-availability.repository";

describe("menuAvailabilityRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createDisable connects the item and records who/why", async () => {
    create.mockResolvedValue({ id: "d1" });

    await createDisable({
      menuItemId: "i1",
      reason: "OUT_OF_STOCK",
      disabledById: "u1",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        menuItem: { connect: { id: "i1" } },
        reason: "OUT_OF_STOCK",
        note: null,
        disabledById: "u1",
        resumeAt: null,
      },
    });
  });

  it("findOpenDisable fetches the latest not-yet-re-enabled 86", async () => {
    findFirst.mockResolvedValue(null);

    await findOpenDisable("i1");

    expect(findFirst).toHaveBeenCalledWith({
      where: { menuItemId: "i1", reenabledAt: null },
      orderBy: { disabledAt: "desc" },
    });
  });

  it("closeDisable records re-enable time and user", async () => {
    update.mockResolvedValue({});

    await closeDisable("d1", "u2");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1" },
        data: expect.objectContaining({
          reenabledById: "u2",
          reenabledAt: expect.any(Date),
        }),
      }),
    );
  });
});
