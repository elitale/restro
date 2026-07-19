import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/order.service", () => ({
  createOrder: vi.fn(),
  addItems: vi.fn(),
  fireOrder: vi.fn(),
  serveLine: vi.fn(),
  voidLine: vi.fn(),
  voidWholeOrder: vi.fn(),
}));
vi.mock("@/services/settlement.service", () => ({
  settle: vi.fn(),
  settleTable: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { createOrder, fireOrder } from "@/services/order.service";
import { settle, settleTable } from "@/services/settlement.service";
import {
  createOrderAction,
  fireOrderAction,
  settleOrderAction,
  settleTableAction,
} from "./order.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

const validCreate = {
  orderType: "TAKEAWAY" as const,
  idempotencyKey: "idem-12345",
  items: [{ menuItemId: "i1", quantity: 1 }],
};

describe("order actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("createOrderAction delegates with the manager context", async () => {
    const result = await createOrderAction(validCreate);

    expect(result.success).toBe(true);
    expect(createOrder).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ orderType: "TAKEAWAY", idempotencyKey: "idem-12345" }),
    );
  });

  it("createOrderAction rejects an order with no items", async () => {
    const result = await createOrderAction({ ...validCreate, items: [] });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("fireOrderAction passes the order id through", async () => {
    const result = await fireOrderAction({ orderId: "o1" });

    expect(result.success).toBe(true);
    expect(fireOrder).toHaveBeenCalledWith(CTX, "o1");
  });

  it("settleOrderAction delegates the validated settlement", async () => {
    const result = await settleOrderAction({
      orderId: "o1",
      payments: [{ mode: "CASH", amount: 105 }],
    });

    expect(result.success).toBe(true);
    expect(settle).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ orderId: "o1" }),
    );
  });

  it("settleTableAction settles all the table's orders", async () => {
    const result = await settleTableAction({
      orderIds: ["o1", "o2"],
      payments: [{ mode: "CASH", amount: 210 }],
    });

    expect(result.success).toBe(true);
    expect(settleTable).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ orderIds: ["o1", "o2"] }),
    );
  });

  it("returns NO_RESTAURANT when the manager has no restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await createOrderAction(validCreate);

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
    expect(createOrder).not.toHaveBeenCalled();
  });
});
