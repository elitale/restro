import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/stock.service", () => ({
  adjustStock: vi.fn(),
  bulkReceive: vi.fn(),
  countStock: vi.fn(),
  createStockItem: vi.fn(),
  deleteStockItem: vi.fn(),
  updateStockItem: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { adjustStock, createStockItem } from "@/services/stock.service";
import {
  adjustStockAction,
  createStockItemAction,
} from "./inventory.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

describe("inventory actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("createStockItemAction delegates with the manager context", async () => {
    const result = await createStockItemAction({
      name: "Paneer",
      unit: "KG",
      openingOnHand: 5,
    });

    expect(result.success).toBe(true);
    expect(createStockItem).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ name: "Paneer", unit: "KG" }),
    );
  });

  it("createStockItemAction rejects a blank name", async () => {
    const result = await createStockItemAction({ name: "", unit: "KG" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(createStockItem).not.toHaveBeenCalled();
  });

  it("adjustStockAction rejects a non-positive quantity", async () => {
    const result = await adjustStockAction({
      stockItemId: "s1",
      type: "WASTE",
      quantity: 0,
    });

    expect(result.success).toBe(false);
    expect(adjustStock).not.toHaveBeenCalled();
  });

  it("returns NO_RESTAURANT when the manager has no restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await createStockItemAction({ name: "Oil", unit: "LITRE" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
