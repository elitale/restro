import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";

vi.mock("@/services/order.service", () => ({
  loadOwnedOrder: vi.fn(),
  orderToBillLines: vi.fn(),
  mapOrder: vi.fn((o: unknown) => o),
  ORDER_NOT_OPEN: "ORDER_NOT_OPEN",
}));
vi.mock("@/repositories/order.repository", () => ({ settleOrder: vi.fn() }));

import { settleOrder } from "@/repositories/order.repository";
import { loadOwnedOrder, orderToBillLines } from "@/services/order.service";
import { PAYMENT_SHORT, settle } from "./settlement.service";

const ctx = { restaurantId: "res_1", userId: "u1" };
const asOrder = (o: object) => o as unknown as OrderWithRelations;

const billLines = [
  {
    unitPrice: 100,
    modifiersDelta: 0,
    quantity: 1,
    taxRate: 5,
    taxInclusive: false,
    isComp: false,
  },
];

describe("settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadOwnedOrder).mockResolvedValue(asOrder({ status: "OPEN" }));
    vi.mocked(orderToBillLines).mockReturnValue(billLines);
    vi.mocked(settleOrder).mockResolvedValue(asOrder({ id: "o1" }));
  });

  it("settles when the tender covers the ₹105 bill", async () => {
    await settle(ctx, {
      orderId: "o1",
      discountType: "NONE",
      discountValue: 0,
      payments: [{ mode: "CASH", amount: 105, tendered: 200 }],
    });

    const arg = vi.mocked(settleOrder).mock.calls[0][2];
    expect(arg.grandTotal).toBe(105);
    expect(arg.taxTotal).toBe(5);
    expect(arg.payments[0]).toMatchObject({ mode: "CASH", receivedById: "u1" });
  });

  it("rejects underpayment", async () => {
    await expect(
      settle(ctx, {
        orderId: "o1",
        discountType: "NONE",
        discountValue: 0,
        payments: [{ mode: "CASH", amount: 50 }],
      }),
    ).rejects.toThrow(PAYMENT_SHORT);
    expect(settleOrder).not.toHaveBeenCalled();
  });

  it("rejects a non-open order", async () => {
    vi.mocked(loadOwnedOrder).mockResolvedValue(
      asOrder({ status: "COMPLETED" }),
    );

    await expect(
      settle(ctx, {
        orderId: "o1",
        discountType: "NONE",
        discountValue: 0,
        payments: [{ mode: "CASH", amount: 105 }],
      }),
    ).rejects.toThrow("ORDER_NOT_OPEN");
  });
});
