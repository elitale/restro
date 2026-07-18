import type { Order, OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ORDER_INCLUDE = {
  items: { orderBy: { sortOrder: "asc" }, include: { modifiers: true } },
  payments: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

export type LineState = "UNSENT" | "FIRED" | "SERVED" | "VOID";

export interface OrderLineWriteData {
  menuItemId: string | null;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  lineNote: string | null;
  taxRate: number;
  taxKind: string;
  taxInclusive: boolean;
  isComp: boolean;
  compReason: string | null;
  state: LineState;
  sortOrder: number;
  modifiers: { modifierId: string | null; name: string; priceDelta: number }[];
}

export interface CreateOrderData {
  restaurantId: string;
  orderNumber: number;
  idempotencyKey: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableLabel: string | null;
  tableId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  note: string | null;
  placedById: string;
  items: OrderLineWriteData[];
}

const lineCreate = (items: OrderLineWriteData[]) =>
  items.map((it) => ({
    menuItemId: it.menuItemId,
    variantId: it.variantId,
    name: it.name,
    variantName: it.variantName,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    lineNote: it.lineNote,
    taxRate: it.taxRate,
    taxKind: it.taxKind,
    taxInclusive: it.taxInclusive,
    isComp: it.isComp,
    compReason: it.compReason,
    state: it.state,
    firedAt: it.state === "FIRED" ? new Date() : null,
    sortOrder: it.sortOrder,
    modifiers: {
      create: it.modifiers.map((m) => ({
        modifierId: m.modifierId,
        name: m.name,
        priceDelta: m.priceDelta,
      })),
    },
  }));

export const createOrder = (
  data: CreateOrderData,
): Promise<OrderWithRelations> =>
  prisma.order.create({
    data: {
      restaurant: { connect: { id: data.restaurantId } },
      orderNumber: data.orderNumber,
      idempotencyKey: data.idempotencyKey,
      orderType: data.orderType,
      tableLabel: data.tableLabel,
      ...(data.tableId ? { table: { connect: { id: data.tableId } } } : {}),
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      note: data.note,
      placedById: data.placedById,
      items: { create: lineCreate(data.items) },
    },
    include: ORDER_INCLUDE,
  });

export const findOrderById = (
  id: string,
): Promise<OrderWithRelations | null> =>
  prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });

export const findOrderByIdempotencyKey = (
  key: string,
): Promise<OrderWithRelations | null> =>
  prisma.order.findUnique({
    where: { idempotencyKey: key },
    include: ORDER_INCLUDE,
  });

export const findOrderOwnership = (
  id: string,
): Promise<{ restaurantId: string; status: OrderStatus } | null> =>
  prisma.order.findUnique({
    where: { id },
    select: { restaurantId: true, status: true },
  });

export const findOrdersByRestaurant = (
  restaurantId: string,
  statuses: OrderStatus[],
): Promise<OrderWithRelations[]> =>
  prisma.order.findMany({
    where: { restaurantId, deletedAt: null, status: { in: statuses } },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

export const maxOrderNumber = async (restaurantId: string): Promise<number> => {
  const top = await prisma.order.findFirst({
    where: { restaurantId },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  return top?.orderNumber ?? 0;
};

export const addOrderItems = (
  orderId: string,
  items: OrderLineWriteData[],
): Promise<OrderWithRelations> =>
  prisma.order.update({
    where: { id: orderId },
    data: { items: { create: lineCreate(items) } },
    include: ORDER_INCLUDE,
  });

export const fireUnsentItems = async (
  orderId: string,
): Promise<OrderWithRelations> => {
  await prisma.orderItem.updateMany({
    where: { orderId, state: "UNSENT" },
    data: { state: "FIRED", firedAt: new Date() },
  });
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
};

export const setLineState = async (
  itemId: string,
  state: "SERVED" | "VOID",
  voidReason: string | null = null,
): Promise<void> => {
  await prisma.orderItem.update({
    where: { id: itemId },
    data: { state, voidReason },
  });
};

export const voidOrder = (
  id: string,
  voidedById: string,
  reason: string,
): Promise<Order> =>
  prisma.order.update({
    where: { id },
    data: { status: "VOID", voidedById, voidReason: reason },
  });

export interface SettleData {
  subtotal: number;
  taxTotal: number;
  discountType: "NONE" | "PERCENT" | "FLAT";
  discountValue: number;
  discountReason: string | null;
  discountTotal: number;
  compTotal: number;
  roundOff: number;
  grandTotal: number;
  payments: {
    mode: "CASH" | "UPI" | "CARD" | "OTHER";
    amount: number;
    tendered: number | null;
    reference: string | null;
    receivedById: string;
  }[];
}

/** Assign the next gap-free invoice number + record settlement, atomically. */
export const settleOrder = (
  id: string,
  restaurantId: string,
  data: SettleData,
): Promise<OrderWithRelations> =>
  prisma.$transaction(async (tx) => {
    const seq = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { nextInvoiceSeq: { increment: 1 } },
      select: { nextInvoiceSeq: true },
    });
    const invoiceNumber = seq.nextInvoiceSeq - 1;

    return tx.order.update({
      where: { id },
      data: {
        status: "COMPLETED",
        settledAt: new Date(),
        invoiceNumber,
        subtotal: data.subtotal,
        taxTotal: data.taxTotal,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountReason: data.discountReason,
        discountTotal: data.discountTotal,
        compTotal: data.compTotal,
        roundOff: data.roundOff,
        grandTotal: data.grandTotal,
        payments: {
          create: data.payments.map((p) => ({
            mode: p.mode,
            amount: p.amount,
            tendered: p.tendered,
            reference: p.reference,
            receivedById: p.receivedById,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
  });

export const findSettledOrdersSince = (
  restaurantId: string,
  since: Date,
): Promise<OrderWithRelations[]> =>
  prisma.order.findMany({
    where: { restaurantId, status: "COMPLETED", settledAt: { gte: since } },
    include: ORDER_INCLUDE,
    orderBy: { settledAt: "desc" },
  });

export const countVoidedSince = (
  restaurantId: string,
  since: Date,
): Promise<number> =>
  prisma.order.count({
    where: { restaurantId, status: "VOID", updatedAt: { gte: since } },
  });
