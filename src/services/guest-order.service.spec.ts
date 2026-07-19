import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant } from "@/generated/prisma/client";
import type { OrderDTO } from "@/types/order";

vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantByUsername: vi.fn(),
}));
vi.mock("@/repositories/order.repository", () => ({
  findOrdersForGuest: vi.fn(),
}));
vi.mock("@/services/table.service", () => ({
  resolveTableForOrder: vi.fn(),
}));
vi.mock("@/services/menu-item.service", () => ({
  getMenu: vi.fn(),
}));
vi.mock("@/services/order.service", () => ({
  listOrders: vi.fn(),
  createOrder: vi.fn(),
  addItems: vi.fn(),
  fireOrder: vi.fn(),
}));

import type { OrderWithRelations } from "@/repositories/order.repository";
import { findOrdersForGuest } from "@/repositories/order.repository";
import { findRestaurantByUsername } from "@/repositories/restaurant.repository";
import { getMenu } from "@/services/menu-item.service";
import {
  addItems,
  createOrder,
  fireOrder,
  listOrders,
} from "@/services/order.service";
import { resolveTableForOrder } from "@/services/table.service";
import {
  GUEST_ORDER_DISABLED,
  GUEST_ORDER_RESTAURANT_NOT_FOUND,
  GUEST_ORDER_TABLE_INVALID,
  getGuestOrders,
  loadGuestOrderPage,
  placeGuestOrder,
  resolveGuestOrderTarget,
} from "./guest-order.service";

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant =>
  ({
    id: "res_1",
    username: "elitale",
    isActive: true,
    deletedAt: null,
    selfOrderEnabled: true,
    ...overrides,
  }) as Restaurant;

const ITEMS = [{ menuItemId: "i1", quantity: 2, isComp: false, modifierIds: [] }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveTableForOrder).mockResolvedValue({ id: "t1", label: "T1" });
});

describe("resolveGuestOrderTarget", () => {
  it("returns the restaurant + table when self-order is enabled", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(makeRestaurant());

    const target = await resolveGuestOrderTarget("elitale", "t1");

    expect(target).toEqual({
      restaurantId: "res_1",
      tableId: "t1",
      tableLabel: "T1",
    });
  });

  it("throws when the restaurant is missing", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);

    await expect(resolveGuestOrderTarget("nope", "t1")).rejects.toThrow(
      GUEST_ORDER_RESTAURANT_NOT_FOUND,
    );
  });

  it("throws when self-order is disabled", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(
      makeRestaurant({ selfOrderEnabled: false }),
    );

    await expect(resolveGuestOrderTarget("elitale", "t1")).rejects.toThrow(
      GUEST_ORDER_DISABLED,
    );
  });

  it("throws when the table does not belong to the restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(makeRestaurant());
    vi.mocked(resolveTableForOrder).mockRejectedValue(new Error("TABLE_FORBIDDEN"));

    await expect(resolveGuestOrderTarget("elitale", "tX")).rejects.toThrow(
      GUEST_ORDER_TABLE_INVALID,
    );
  });
});

describe("placeGuestOrder", () => {
  const actor = { restaurantId: "res_1", tableId: "t1", phone: "+919876543210" };

  it("creates a new dine-in order tagged SELF_ORDER when the table has none", async () => {
    vi.mocked(listOrders).mockResolvedValue([]);
    vi.mocked(createOrder).mockResolvedValue({ id: "o1" } as OrderDTO);

    await placeGuestOrder(actor, {
      username: "elitale",
      tableId: "t1",
      idempotencyKey: "abcd1234",
      items: ITEMS,
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ source: "SELF_ORDER", userId: null }),
      expect.objectContaining({
        orderType: "DINE_IN",
        tableId: "t1",
        customerPhone: "+919876543210",
      }),
    );
    expect(addItems).not.toHaveBeenCalled();
  });

  it("appends + fires to the table's existing open order", async () => {
    vi.mocked(listOrders).mockResolvedValue([
      { id: "o9", tableId: "t1" } as OrderDTO,
    ]);
    vi.mocked(fireOrder).mockResolvedValue({ id: "o9" } as OrderDTO);

    await placeGuestOrder(actor, {
      username: "elitale",
      tableId: "t1",
      idempotencyKey: "abcd1234",
      items: ITEMS,
    });

    expect(addItems).toHaveBeenCalledWith(
      expect.objectContaining({ source: "SELF_ORDER" }),
      expect.objectContaining({ orderId: "o9" }),
    );
    expect(fireOrder).toHaveBeenCalledWith(
      expect.objectContaining({ source: "SELF_ORDER" }),
      "o9",
    );
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe("loadGuestOrderPage", () => {
  const menu = { categories: [], items: [] };

  it("returns ok with menu + table when enabled", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(makeRestaurant());
    vi.mocked(getMenu).mockResolvedValue(menu);

    const result = await loadGuestOrderPage("elitale", "t1");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.tableLabel).toBe("T1");
      expect(result.data.menu).toBe(menu);
    }
  });

  it("returns not_found for a missing restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);

    expect((await loadGuestOrderPage("nope", "t1")).status).toBe("not_found");
    expect(getMenu).not.toHaveBeenCalled();
  });

  it("returns disabled when self-order is off", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(
      makeRestaurant({ selfOrderEnabled: false }),
    );

    expect((await loadGuestOrderPage("elitale", "t1")).status).toBe("disabled");
  });

  it("returns invalid_table when the table query param is missing", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(makeRestaurant());

    expect((await loadGuestOrderPage("elitale", undefined)).status).toBe(
      "invalid_table",
    );
    expect(resolveTableForOrder).not.toHaveBeenCalled();
  });

  it("returns invalid_table when the table does not belong to the restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(makeRestaurant());
    vi.mocked(resolveTableForOrder).mockRejectedValue(new Error("TABLE_NOT_FOUND"));

    expect((await loadGuestOrderPage("elitale", "tX")).status).toBe(
      "invalid_table",
    );
  });
});

describe("getGuestOrders", () => {
  it("maps orders to PII-free summaries with live kitchen status", async () => {
    vi.mocked(findOrdersForGuest).mockResolvedValue([
      {
        id: "o1",
        orderNumber: 3,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        orderType: "DINE_IN",
        tableLabel: "T1",
        status: "OPEN",
        grandTotal: 0,
        items: [
          {
            state: "FIRED",
            quantity: 2,
            unitPrice: 50,
            taxRate: 0,
            taxInclusive: false,
            isComp: false,
            name: "Masala Tea",
            variantName: null,
            modifiers: [],
          },
          { state: "VOID", quantity: 1, name: "Cancelled", modifiers: [] },
        ],
      } as unknown as OrderWithRelations,
    ]);

    const [summary] = await getGuestOrders("res_1", "+919876543210", "t1");

    expect(summary).toMatchObject({
      id: "o1",
      orderNumber: 3,
      tableLabel: "T1",
      status: "OPEN",
      kitchenStatus: "WAITING",
      itemCount: 2,
      total: 100,
    });
    // Void lines are excluded; no PII fields are exposed.
    expect(summary.lines).toEqual([
      { name: "Masala Tea", variantName: null, quantity: 2, state: "FIRED" },
    ]);
    expect(summary).not.toHaveProperty("customerPhone");
  });

  it("uses the settled grand total for completed orders", async () => {
    vi.mocked(findOrdersForGuest).mockResolvedValue([
      {
        id: "o2",
        orderNumber: 4,
        createdAt: new Date("2026-01-01T11:00:00Z"),
        orderType: "DINE_IN",
        tableLabel: "T2",
        status: "COMPLETED",
        grandTotal: 210,
        items: [
          {
            state: "SERVED",
            quantity: 1,
            unitPrice: 200,
            taxRate: 5,
            taxInclusive: false,
            isComp: false,
            name: "Thali",
            variantName: null,
            modifiers: [],
          },
        ],
      } as unknown as OrderWithRelations,
    ]);

    const [summary] = await getGuestOrders("res_1", "+919876543210", "t1");

    expect(summary.status).toBe("COMPLETED");
    expect(summary.kitchenStatus).toBeNull();
    expect(summary.total).toBe(210);
  });
});
