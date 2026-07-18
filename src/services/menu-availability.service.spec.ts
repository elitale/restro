import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuItemAvailability } from "@/generated/prisma/client";

vi.mock("@/repositories/menu-availability.repository", () => ({
  createDisable: vi.fn(),
  findOpenDisable: vi.fn(),
  closeDisable: vi.fn(),
}));
vi.mock("@/services/menu-item.service", () => ({
  assertItemOwned: vi.fn(),
}));

import {
  closeDisable,
  createDisable,
  findOpenDisable,
} from "@/repositories/menu-availability.repository";
import {
  disableItem,
  ITEM_ALREADY_DISABLED,
  ITEM_NOT_DISABLED,
  reenableItem,
} from "./menu-availability.service";

const makeDisable = (
  overrides: Partial<MenuItemAvailability> = {},
): MenuItemAvailability => ({
  id: "d1",
  menuItemId: "i1",
  reason: "OUT_OF_STOCK",
  note: null,
  disabledById: "u1",
  disabledAt: new Date(),
  resumeAt: null,
  reenabledAt: null,
  reenabledById: null,
  ...overrides,
});

describe("disableItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a 86 with reason + user when not already disabled", async () => {
    vi.mocked(findOpenDisable).mockResolvedValue(null);

    await disableItem("res_1", "u1", { itemId: "i1", reason: "OUT_OF_STOCK" });

    expect(createDisable).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: "i1",
        reason: "OUT_OF_STOCK",
        disabledById: "u1",
      }),
    );
  });

  it("rejects when a live 86 already exists", async () => {
    vi.mocked(findOpenDisable).mockResolvedValue(makeDisable({ resumeAt: null }));

    await expect(
      disableItem("res_1", "u1", { itemId: "i1", reason: "QUALITY" }),
    ).rejects.toThrow(ITEM_ALREADY_DISABLED);
    expect(createDisable).not.toHaveBeenCalled();
  });
});

describe("reenableItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes the open 86", async () => {
    vi.mocked(findOpenDisable).mockResolvedValue(makeDisable({ id: "d9" }));

    await reenableItem("res_1", "u2", "i1");

    expect(closeDisable).toHaveBeenCalledWith("d9", "u2");
  });

  it("rejects when the item is not disabled", async () => {
    vi.mocked(findOpenDisable).mockResolvedValue(null);

    await expect(reenableItem("res_1", "u2", "i1")).rejects.toThrow(
      ITEM_NOT_DISABLED,
    );
  });
});
