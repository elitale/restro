import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";

vi.mock("@/repositories/order.repository", () => ({
  findSettledOrdersSince: vi.fn(),
  countVoidedSince: vi.fn(),
}));

import {
  countVoidedSince,
  findSettledOrdersSince,
} from "@/repositories/order.repository";
import { getTodaySales } from "./sales.service";

const settled = (grandTotal: number, taxTotal: number, payments: object[]) =>
  ({ grandTotal, taxTotal, discountTotal: 0, payments }) as unknown as OrderWithRelations;

describe("getTodaySales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aggregates totals and payments by mode", async () => {
    vi.mocked(findSettledOrdersSince).mockResolvedValue([
      settled(105, 5, [{ mode: "CASH", amount: 105 }]),
      settled(210, 10, [
        { mode: "CASH", amount: 100 },
        { mode: "UPI", amount: 110 },
      ]),
    ]);
    vi.mocked(countVoidedSince).mockResolvedValue(1);

    const sales = await getTodaySales("res_1");

    expect(sales.orders).toBe(2);
    expect(sales.gross).toBe(315);
    expect(sales.tax).toBe(15);
    expect(sales.voids).toBe(1);

    const cash = sales.byMode.find((m) => m.mode === "CASH");
    const upi = sales.byMode.find((m) => m.mode === "UPI");
    expect(cash).toEqual({ mode: "CASH", amount: 205, count: 2 });
    expect(upi).toEqual({ mode: "UPI", amount: 110, count: 1 });
  });
});
