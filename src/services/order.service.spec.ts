import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";
import type { MenuDTO } from "@/types/menu";

vi.mock("@/services/menu-item.service", () => ({ getMenu: vi.fn() }));
vi.mock("@/services/table.service", () => ({ resolveTableForOrder: vi.fn() }));
vi.mock("@/services/stock-depletion.service", () => ({
  depleteForLines: vi.fn(() => Promise.resolve()),
  restoreForLines: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/repositories/order.repository", () => ({
  addOrderItems: vi.fn(),
  createOrder: vi.fn(),
  findOrderByIdempotencyKey: vi.fn(),
  findOrderById: vi.fn(),
  findOrdersByRestaurant: vi.fn(),
  fireUnsentItems: vi.fn(),
  maxOrderNumber: vi.fn(),
  setLineState: vi.fn(),
  voidOrder: vi.fn(),
}));

import { getMenu } from "@/services/menu-item.service";
import { resolveTableForOrder } from "@/services/table.service";
import {
  addOrderItems,
  createOrder as createOrderRepo,
  findOrderById,
  findOrderByIdempotencyKey,
  maxOrderNumber,
  setLineState,
} from "@/repositories/order.repository";
import {
  addItems,
  createOrder,
  ITEM_UNAVAILABLE,
  ORDER_FORBIDDEN,
  ORDER_ITEM_NOT_FOUND,
  ORDER_NOT_OPEN,
  voidLine,
} from "./order.service";

const makeMenu = (available = true): MenuDTO => ({
  categories: [
    { id: "c1", name: "Drinks", description: null, sortOrder: 0, isActive: true },
  ],
  items: [
    {
      id: "i1",
      categoryId: "c1",
      name: "Masala Tea",
      shortDescription: null,
      longDescription: null,
      itemType: "SERVED",
      dietaryType: null,
      price: 50,
      isActive: true,
      available,
      disabledReason: null,
      resumeAt: null,
      tax: {
        kind: "SERVICE",
        rate: 5,
        code: "996331",
        separatelyCharged: true,
        inclusive: false,
      },
      images: [],
      variants: [{ id: "v1", name: "Large", price: 70 }],
      modifierGroups: [
        {
          id: "g1",
          name: "Extras",
          minSelect: 0,
          maxSelect: 2,
          isRequired: false,
          modifiers: [{ id: "m1", name: "Extra sugar", priceDelta: 5 }],
        },
      ],
    },
  ],
});

const makeOrder = (o: Partial<OrderWithRelations> = {}): OrderWithRelations =>
  ({
    id: "o1",
    restaurantId: "res_1",
    orderNumber: 5,
    invoiceNumber: null,
    idempotencyKey: "key12345",
    orderType: "TAKEAWAY",
    status: "OPEN",
    tableLabel: null,
    tableId: null,
    customerName: null,
    customerPhone: null,
    customerAddress: null,
    note: null,
    subtotal: 0,
    taxTotal: 0,
    discountType: "NONE",
    discountValue: 0,
    discountReason: null,
    discountTotal: 0,
    compTotal: 0,
    roundOff: 0,
    grandTotal: 0,
    placedById: "u1",
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
    updatedAt: new Date("2026-07-18T00:00:00.000Z"),
    settledAt: null,
    deletedAt: null,
    items: [],
    payments: [],
    ...o,
  }) as unknown as OrderWithRelations;

const ctx = { restaurantId: "res_1", userId: "u1" };

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMenu).mockResolvedValue(makeMenu());
    vi.mocked(createOrderRepo).mockResolvedValue(makeOrder());
  });

  it("returns the existing order for a repeated idempotency key", async () => {
    vi.mocked(findOrderByIdempotencyKey).mockResolvedValue(
      makeOrder({ orderNumber: 9 }),
    );

    const dto = await createOrder(ctx, {
      orderType: "TAKEAWAY",
      idempotencyKey: "key12345",
      items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
    });

    expect(dto.orderNumber).toBe(9);
    expect(createOrderRepo).not.toHaveBeenCalled();
  });

  it("snapshots the line from the menu and fires it", async () => {
    vi.mocked(findOrderByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(maxOrderNumber).mockResolvedValue(4);

    await createOrder(ctx, {
      orderType: "TAKEAWAY",
      idempotencyKey: "key12345",
      items: [
        {
          menuItemId: "i1",
          variantId: "v1",
          quantity: 2,
          isComp: false,
          modifierIds: ["m1"],
        },
      ],
    });

    const arg = vi.mocked(createOrderRepo).mock.calls[0][0];
    expect(arg.orderNumber).toBe(5);
    expect(arg.items[0]).toMatchObject({
      name: "Masala Tea",
      variantName: "Large",
      unitPrice: 70,
      taxRate: 5,
      state: "FIRED",
    });
    expect(arg.items[0].modifiers[0]).toMatchObject({
      name: "Extra sugar",
      priceDelta: 5,
    });
  });

  it("rejects an unavailable item", async () => {
    vi.mocked(findOrderByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(getMenu).mockResolvedValue(makeMenu(false));

    await expect(
      createOrder(ctx, {
        orderType: "TAKEAWAY",
        idempotencyKey: "key12345",
        items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
      }),
    ).rejects.toThrow(ITEM_UNAVAILABLE);
  });

  it("resolves the authoritative table label from tableId", async () => {
    vi.mocked(findOrderByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(maxOrderNumber).mockResolvedValue(4);
    vi.mocked(resolveTableForOrder).mockResolvedValue({ id: "tbl_1", label: "T7" });

    await createOrder(ctx, {
      orderType: "DINE_IN",
      idempotencyKey: "key12345",
      tableId: "tbl_1",
      tableLabel: "ignored",
      items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
    });

    expect(resolveTableForOrder).toHaveBeenCalledWith("res_1", "tbl_1");
    const arg = vi.mocked(createOrderRepo).mock.calls[0][0];
    expect(arg.tableId).toBe("tbl_1");
    expect(arg.tableLabel).toBe("T7");
  });

  it("attributes a waiter-placed order to the staff member", async () => {
    vi.mocked(findOrderByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(maxOrderNumber).mockResolvedValue(4);

    await createOrder(
      { restaurantId: "res_1", userId: null, staffId: "st1" },
      {
        orderType: "DINE_IN",
        idempotencyKey: "key12345",
        items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
      },
    );

    const arg = vi.mocked(createOrderRepo).mock.calls[0][0];
    expect(arg.placedById).toBeNull();
    expect(arg.placedByStaffId).toBe("st1");
  });
});

describe("addItems / voidLine ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMenu).mockResolvedValue(makeMenu());
  });

  it("addItems rejects a settled order", async () => {
    vi.mocked(findOrderById).mockResolvedValue(makeOrder({ status: "COMPLETED" }));

    await expect(
      addItems(ctx, {
        orderId: "o1",
        items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
      }),
    ).rejects.toThrow(ORDER_NOT_OPEN);
    expect(addOrderItems).not.toHaveBeenCalled();
  });

  it("addItems rejects an order from another restaurant", async () => {
    vi.mocked(findOrderById).mockResolvedValue(
      makeOrder({ restaurantId: "other" }),
    );

    await expect(
      addItems(ctx, {
        orderId: "o1",
        items: [{ menuItemId: "i1", quantity: 1, isComp: false, modifierIds: [] }],
      }),
    ).rejects.toThrow(ORDER_FORBIDDEN);
  });

  it("voidLine rejects a line not on the order", async () => {
    vi.mocked(findOrderById).mockResolvedValue(makeOrder({ items: [] }));

    await expect(
      voidLine(ctx, { orderId: "o1", itemId: "nope", reason: "spill" }),
    ).rejects.toThrow(ORDER_ITEM_NOT_FOUND);
    expect(setLineState).not.toHaveBeenCalled();
  });
});
