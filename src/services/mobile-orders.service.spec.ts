import { describe, expect, it } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";

import { toMobileOrderDto } from "./mobile-orders.service";

process.env.AUTH_SECRET = "test-secret";

const baseOrder = (
  overrides?: Partial<OrderWithRelations>,
): OrderWithRelations => ({
  id: "ord_1",
  restaurantId: "rest_1",
  orderNumber: 5421,
  invoiceNumber: null,
  idempotencyKey: "req_test",
  orderType: "DINE_IN",
  status: "OPEN",
  tableLabel: "Table 12",
  tableId: null,
  customerName: null,
  customerPhone: null,
  customerAddress: null,
  note: "allergic to peanuts",
  subtotal: 1000 as unknown as OrderWithRelations["subtotal"],
  taxTotal: 0 as unknown as OrderWithRelations["taxTotal"],
  discountType: "NONE",
  discountValue: 0 as unknown as OrderWithRelations["discountValue"],
  discountReason: null,
  discountTotal: 0 as unknown as OrderWithRelations["discountTotal"],
  compTotal: 0 as unknown as OrderWithRelations["compTotal"],
  roundOff: 0 as unknown as OrderWithRelations["roundOff"],
  grandTotal: 1000 as unknown as OrderWithRelations["grandTotal"],
  placedById: null,
  placedByStaffId: null,
  voidedById: null,
  voidReason: null,
  createdAt: new Date(Date.now() - 2 * 60_000),
  updatedAt: new Date(),
  settledAt: null,
  deletedAt: null,
  items: [
    {
      id: "it_1",
      orderId: "ord_1",
      menuItemId: null,
      variantId: null,
      name: "Paneer tikka",
      variantName: null,
      unitPrice: 320 as unknown as OrderWithRelations["items"][number]["unitPrice"],
      quantity: 2,
      lineNote: null,
      taxRate: 0 as unknown as OrderWithRelations["items"][number]["taxRate"],
      taxKind: "NONE",
      taxInclusive: false,
      state: "UNSENT",
      source: "STAFF",
      isComp: false,
      compReason: null,
      firedAt: null,
      voidReason: null,
      sortOrder: 0,
      createdAt: new Date(),
      modifiers: [],
    },
  ],
  payments: [],
  ...overrides,
});

describe("toMobileOrderDto", () => {
  it("maps a fresh DINE_IN order into the mobile DTO shape", () => {
    const dto = toMobileOrderDto(baseOrder());
    expect(dto.channel).toBe("dine-in");
    expect(dto.orderNumber).toBe("T-5421");
    expect(dto.status).toBe("new");
    expect(dto.tableLabel).toBe("Table 12");
    expect(dto.totalAmount).toBe("\u20B91,000");
    expect(dto.note).toBe("allergic to peanuts");
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toEqual({
      id: "it_1",
      name: "Paneer tikka",
      quantity: 2,
      priceRupees: 320,
      modifiers: [],
      station: null,
    });
  });

  it("derives status=preparing when any item is PREPARING", () => {
    const dto = toMobileOrderDto(
      baseOrder({
        items: [
          { ...baseOrder().items[0], state: "PREPARING" },
        ],
      }),
    );
    expect(dto.status).toBe("preparing");
  });

  it("derives status=ready when every item is PREPARED", () => {
    const dto = toMobileOrderDto(
      baseOrder({
        items: [
          { ...baseOrder().items[0], state: "PREPARED" },
        ],
      }),
    );
    expect(dto.status).toBe("ready");
  });

  it("derives status=settled for COMPLETED orders", () => {
    const dto = toMobileOrderDto(baseOrder({ status: "COMPLETED" }));
    expect(dto.status).toBe("settled");
  });

  it("filters out VOID items from the DTO", () => {
    const order = baseOrder();
    order.items = [
      order.items[0],
      { ...order.items[0], id: "it_2", state: "VOID", name: "Void line" },
    ];
    const dto = toMobileOrderDto(order);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].id).toBe("it_1");
  });

  it("promotes late orders to `late` priority when the order is old and unserved", () => {
    const dto = toMobileOrderDto(
      baseOrder({
        createdAt: new Date(Date.now() - 20 * 60_000),
        items: [{ ...baseOrder().items[0], state: "PREPARING" }],
      }),
    );
    expect(dto.priority).toBe("late");
  });
});
