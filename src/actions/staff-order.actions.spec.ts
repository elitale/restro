import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/order.service", () => ({
  addItems: vi.fn(),
  createOrder: vi.fn(),
  fireOrder: vi.fn(),
}));

import { getStaffContextOrNull } from "@/lib/staff-auth";
import { addItems, createOrder, fireOrder } from "@/services/order.service";
import {
  addWaiterItemsAction,
  createWaiterOrderAction,
} from "./staff-order.actions";

const waiterCtx = {
  staffId: "st1",
  restaurantId: "res_1",
  role: "WAITER" as const,
  name: "Ramesh",
  employeeCode: "E1",
};

const validOrder = {
  orderType: "DINE_IN" as const,
  idempotencyKey: "key12345",
  tableId: "tbl_1",
  items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
};

describe("createWaiterOrderAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the order attributed to the waiter (no manager userId)", async () => {
    vi.mocked(getStaffContextOrNull).mockResolvedValue(waiterCtx);

    const result = await createWaiterOrderAction(validOrder);

    expect(result.success).toBe(true);
    expect(createOrder).toHaveBeenCalledWith(
      { restaurantId: "res_1", userId: null, staffId: "st1" },
      expect.objectContaining({ orderType: "DINE_IN" }),
    );
  });

  it("rejects a kitchen staff member (waiter-only)", async () => {
    vi.mocked(getStaffContextOrNull).mockResolvedValue({
      ...waiterCtx,
      role: "KITCHEN",
    });

    const result = await createWaiterOrderAction(validOrder);

    expect(result.success).toBe(false);
    expect(result.error).toBe("STAFF_FORBIDDEN");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects without a staff session", async () => {
    vi.mocked(getStaffContextOrNull).mockResolvedValue(null);

    const result = await createWaiterOrderAction(validOrder);

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_STAFF_SESSION");
  });

  it("rejects an empty cart", async () => {
    vi.mocked(getStaffContextOrNull).mockResolvedValue(waiterCtx);

    const result = await createWaiterOrderAction({ ...validOrder, items: [] });

    expect(result.success).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe("addWaiterItemsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds items then fires them", async () => {
    vi.mocked(getStaffContextOrNull).mockResolvedValue(waiterCtx);

    const result = await addWaiterItemsAction({
      orderId: "o1",
      items: [{ menuItemId: "i1", quantity: 2, isComp: false, modifierIds: [] }],
    });

    expect(result.success).toBe(true);
    expect(addItems).toHaveBeenCalledWith(
      { restaurantId: "res_1", userId: null, staffId: "st1" },
      expect.objectContaining({ orderId: "o1" }),
    );
    expect(fireOrder).toHaveBeenCalledWith(
      { restaurantId: "res_1", userId: null, staffId: "st1" },
      "o1",
    );
  });
});
