import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/stock.repository", () => ({ applyMovements: vi.fn() }));
vi.mock("@/services/recipe.service", () => ({ getRecipesMap: vi.fn() }));

import { applyMovements } from "@/repositories/stock.repository";
import { getRecipesMap } from "@/services/recipe.service";
import { depleteForLines, restoreForLines } from "./stock-depletion.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

describe("stock depletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("depletes aggregated recipe × line quantity as negative movements", async () => {
    vi.mocked(getRecipesMap).mockResolvedValue(
      new Map([
        ["m1", [{ stockItemId: "flour", quantity: 0.1 }, { stockItemId: "butter", quantity: 0.05 }]],
        ["m2", [{ stockItemId: "flour", quantity: 0.2 }]],
      ]),
    );

    await depleteForLines(
      ctx,
      [
        { menuItemId: "m1", quantity: 2 },
        { menuItemId: "m2", quantity: 1 },
      ],
      "o1",
    );

    const inputs = vi.mocked(applyMovements).mock.calls[0][0];
    const flour = inputs.find((i) => i.stockItemId === "flour");
    const butter = inputs.find((i) => i.stockItemId === "butter");
    // flour: 0.1*2 + 0.2*1 = 0.4 (negative)
    expect(flour?.delta).toBeCloseTo(-0.4);
    expect(butter?.delta).toBeCloseTo(-0.1);
    expect(flour?.type).toBe("SALE_DEPLETION");
    expect(flour?.orderId).toBe("o1");
  });

  it("is a no-op when no ordered line has a recipe", async () => {
    vi.mocked(getRecipesMap).mockResolvedValue(new Map());

    await depleteForLines(ctx, [{ menuItemId: "m1", quantity: 3 }], "o1");

    expect(applyMovements).not.toHaveBeenCalled();
  });

  it("restore applies positive movements", async () => {
    vi.mocked(getRecipesMap).mockResolvedValue(
      new Map([["m1", [{ stockItemId: "flour", quantity: 0.1 }]]]),
    );

    await restoreForLines(ctx, [{ menuItemId: "m1", quantity: 2 }], "o1");

    const inputs = vi.mocked(applyMovements).mock.calls[0][0];
    expect(inputs[0].delta).toBeCloseTo(0.2);
  });
});
