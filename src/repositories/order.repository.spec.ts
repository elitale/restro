import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  orderCreate,
  orderFindUnique,
  orderFindFirst,
  orderFindMany,
  orderUpdate,
  findUniqueOrThrow,
  orderItemUpdateMany,
  restaurantUpdate,
  transaction,
} = vi.hoisted(() => ({
  orderCreate: vi.fn(),
  orderFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderUpdate: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  restaurantUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      create: orderCreate,
      findUnique: orderFindUnique,
      findFirst: orderFindFirst,
      findMany: orderFindMany,
      update: orderUpdate,
      findUniqueOrThrow,
    },
    orderItem: { updateMany: orderItemUpdateMany },
    restaurant: { update: restaurantUpdate },
    $transaction: transaction,
  },
}));

import {
  advanceLineStates,
  createOrder,
  findOrdersForGuest,
  fireUnsentItems,
  maxOrderNumber,
  settleManyOrders,
  settleOrder,
  type OrderLineWriteData,
} from "./order.repository";

const line = (overrides: Partial<OrderLineWriteData> = {}): OrderLineWriteData => ({
  menuItemId: "i1",
  variantId: null,
  name: "Masala Tea",
  variantName: null,
  unitPrice: 50,
  quantity: 2,
  lineNote: null,
  taxRate: 5,
  taxKind: "SERVICE",
  taxInclusive: false,
  isComp: false,
  compReason: null,
  state: "FIRED",
  source: "STAFF",
  sortOrder: 0,
  modifiers: [{ modifierId: "m1", name: "Extra sugar", priceDelta: 5 }],
  ...overrides,
});

describe("orderRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createOrder nests items + modifiers and fires them", async () => {
    orderCreate.mockResolvedValue({ id: "o1" });

    await createOrder({
      restaurantId: "res_1",
      orderNumber: 5,
      idempotencyKey: "key12345",
      orderType: "TAKEAWAY",
      tableLabel: null,
      tableId: null,
      customerName: null,
      customerPhone: null,
      customerAddress: null,
      note: null,
      placedById: "u1",
      placedByStaffId: null,
      items: [line()],
    });

    const arg = orderCreate.mock.calls[0][0];
    expect(arg.data.restaurant).toEqual({ connect: { id: "res_1" } });
    expect(arg.data.orderNumber).toBe(5);
    const created = arg.data.items.create[0];
    expect(created.state).toBe("FIRED");
    expect(created.firedAt).toBeInstanceOf(Date);
    expect(created.modifiers.create[0]).toMatchObject({ name: "Extra sugar" });
  });

  it("maxOrderNumber returns the top number or 0", async () => {
    orderFindFirst.mockResolvedValue({ orderNumber: 12 });
    await expect(maxOrderNumber("res_1")).resolves.toBe(12);

    orderFindFirst.mockResolvedValue(null);
    await expect(maxOrderNumber("res_1")).resolves.toBe(0);
  });

  it("findOrdersForGuest matches the phone OR the table, most recent first", async () => {
    orderFindMany.mockResolvedValue([]);

    await findOrdersForGuest("res_1", "+919876543210", "t1", 15);

    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          restaurantId: "res_1",
          deletedAt: null,
          OR: [{ customerPhone: "+919876543210" }, { tableId: "t1" }],
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    );
  });

  it("fireUnsentItems fires only UNSENT lines then reloads", async () => {
    orderItemUpdateMany.mockResolvedValue({ count: 2 });
    findUniqueOrThrow.mockResolvedValue({ id: "o1" });

    await fireUnsentItems("o1");

    expect(orderItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "o1", state: "UNSENT" },
        data: expect.objectContaining({ state: "FIRED" }),
      }),
    );
  });

  it("advanceLineStates moves matching lines and returns the count", async () => {
    orderItemUpdateMany.mockResolvedValue({ count: 3 });

    await expect(advanceLineStates("o1", "FIRED", "PREPARING")).resolves.toBe(3);

    expect(orderItemUpdateMany).toHaveBeenCalledWith({
      where: { orderId: "o1", state: "FIRED" },
      data: { state: "PREPARING" },
    });
  });

  it("settleOrder assigns a gap-free invoice number atomically", async () => {
    const txOrderUpdate = vi.fn().mockResolvedValue({ id: "o1", invoiceNumber: 1 });
    const txRestaurantUpdate = vi.fn().mockResolvedValue({ nextInvoiceSeq: 2 });
    transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        restaurant: { update: txRestaurantUpdate },
        order: { update: txOrderUpdate },
      }),
    );

    await settleOrder("o1", "res_1", {
      subtotal: 100,
      taxTotal: 5,
      discountType: "NONE",
      discountValue: 0,
      discountReason: null,
      discountTotal: 0,
      compTotal: 0,
      roundOff: 0,
      grandTotal: 105,
      payments: [
        {
          mode: "CASH",
          amount: 105,
          tendered: 200,
          reference: null,
          receivedById: "u1",
        },
      ],
    });

    expect(txRestaurantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nextInvoiceSeq: { increment: 1 } },
      }),
    );
    const orderArg = txOrderUpdate.mock.calls[0][0];
    expect(orderArg.data.invoiceNumber).toBe(1);
    expect(orderArg.data.status).toBe("COMPLETED");
    expect(orderArg.data.payments.create[0].mode).toBe("CASH");
  });

  it("settleManyOrders settles every order in a single transaction", async () => {
    const txOrderUpdate = vi.fn().mockResolvedValue({ id: "o", invoiceNumber: 1 });
    const txRestaurantUpdate = vi.fn().mockResolvedValue({ nextInvoiceSeq: 2 });
    transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({
        restaurant: { update: txRestaurantUpdate },
        order: { update: txOrderUpdate },
      }),
    );

    const data = {
      subtotal: 100,
      taxTotal: 5,
      discountType: "NONE" as const,
      discountValue: 0,
      discountReason: null,
      discountTotal: 0,
      compTotal: 0,
      roundOff: 0,
      grandTotal: 105,
      payments: [
        {
          mode: "CASH" as const,
          amount: 105,
          tendered: null,
          reference: null,
          receivedById: "u1",
        },
      ],
    };

    await settleManyOrders("res_1", [
      { orderId: "o1", data },
      { orderId: "o2", data },
    ]);

    expect(txOrderUpdate).toHaveBeenCalledTimes(2);
    expect(txRestaurantUpdate).toHaveBeenCalledTimes(2);
    expect(txOrderUpdate.mock.calls[0][0].where).toEqual({ id: "o1" });
    expect(txOrderUpdate.mock.calls[1][0].where).toEqual({ id: "o2" });
  });
});
