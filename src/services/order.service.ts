import type { OrderStatus } from "@/generated/prisma/client";
import type {
  AddItemsInput,
  CreateOrderInput,
  VoidLineInput,
  VoidOrderInput,
} from "@/lib/validators/order";
import {
  addOrderItems,
  createOrder as createOrderRepo,
  findOrderByIdempotencyKey,
  findOrderById,
  findOrdersByRestaurant,
  fireUnsentItems,
  maxOrderNumber,
  setLineState,
  voidOrder as voidOrderRepo,
  type LineState,
  type OrderLineWriteData,
  type OrderWithRelations,
} from "@/repositories/order.repository";
import type { BillLineInput } from "@/services/billing";
import { getMenu } from "@/services/menu-item.service";
import type { MenuDTO } from "@/types/menu";
import type { OrderDTO } from "@/types/order";

export const ORDER_NOT_FOUND = "ORDER_NOT_FOUND";
export const ORDER_FORBIDDEN = "ORDER_FORBIDDEN";
export const ORDER_NOT_OPEN = "ORDER_NOT_OPEN";
export const ORDER_ITEM_NOT_FOUND = "ORDER_ITEM_NOT_FOUND";
export const MENU_ITEM_NOT_FOUND = "MENU_ITEM_NOT_FOUND";
export const ITEM_UNAVAILABLE = "ITEM_UNAVAILABLE";
export const VARIANT_NOT_FOUND = "VARIANT_NOT_FOUND";
export const MODIFIER_NOT_FOUND = "MODIFIER_NOT_FOUND";

export interface OrderContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const num = (v: unknown): number => Number(v);

// ------------------------------------------------------------------ mapping ---

export const mapOrder = (o: OrderWithRelations): OrderDTO => ({
  id: o.id,
  orderNumber: o.orderNumber,
  invoiceNumber: o.invoiceNumber,
  orderType: o.orderType,
  status: o.status,
  tableLabel: o.tableLabel,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  customerAddress: o.customerAddress,
  note: o.note,
  subtotal: num(o.subtotal),
  taxTotal: num(o.taxTotal),
  discountTotal: num(o.discountTotal),
  compTotal: num(o.compTotal),
  roundOff: num(o.roundOff),
  grandTotal: num(o.grandTotal),
  createdAt: o.createdAt.toISOString(),
  settledAt: o.settledAt ? o.settledAt.toISOString() : null,
  lines: o.items.map((i) => ({
    id: i.id,
    name: i.name,
    variantName: i.variantName,
    unitPrice: num(i.unitPrice),
    quantity: i.quantity,
    lineNote: i.lineNote,
    state: i.state,
    isComp: i.isComp,
    taxRate: num(i.taxRate),
    taxInclusive: i.taxInclusive,
    modifiers: i.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      priceDelta: num(m.priceDelta),
    })),
  })),
  payments: o.payments.map((p) => ({
    id: p.id,
    mode: p.mode,
    amount: num(p.amount),
    tendered: p.tendered != null ? num(p.tendered) : null,
    reference: p.reference,
  })),
});

/** Bill lines from a persisted order (voided lines excluded). */
export const orderToBillLines = (o: OrderWithRelations): BillLineInput[] =>
  o.items
    .filter((i) => i.state !== "VOID")
    .map((i) => ({
      unitPrice: num(i.unitPrice),
      modifiersDelta: i.modifiers.reduce((s, m) => s + num(m.priceDelta), 0),
      quantity: i.quantity,
      taxRate: num(i.taxRate),
      taxInclusive: i.taxInclusive,
      isComp: i.isComp,
    }));

// ------------------------------------------------------------- snapshotting ---

const snapshotLines = (
  menu: MenuDTO,
  lines: CreateOrderInput["items"],
  startSort: number,
  state: LineState,
): OrderLineWriteData[] => {
  const itemsById = new Map(menu.items.map((i) => [i.id, i]));
  return lines.map((line, idx) => {
    const item = itemsById.get(line.menuItemId);
    if (!item) {
      throw new Error(MENU_ITEM_NOT_FOUND);
    }
    if (!item.available) {
      throw new Error(ITEM_UNAVAILABLE);
    }
    const variant = line.variantId
      ? item.variants.find((v) => v.id === line.variantId)
      : undefined;
    if (line.variantId && !variant) {
      throw new Error(VARIANT_NOT_FOUND);
    }
    const modsById = new Map(
      item.modifierGroups.flatMap((g) => g.modifiers).map((m) => [m.id, m]),
    );
    const modifiers = line.modifierIds.map((id) => {
      const m = modsById.get(id);
      if (!m) {
        throw new Error(MODIFIER_NOT_FOUND);
      }
      return { modifierId: m.id, name: m.name, priceDelta: m.priceDelta };
    });
    return {
      menuItemId: item.id,
      variantId: variant?.id ?? null,
      name: item.name,
      variantName: variant?.name ?? null,
      unitPrice: variant ? variant.price : item.price,
      quantity: line.quantity,
      lineNote: line.lineNote ?? null,
      taxRate: item.tax.rate,
      taxKind: item.tax.kind,
      taxInclusive: item.tax.inclusive,
      isComp: line.isComp,
      compReason: line.compReason ?? null,
      state,
      sortOrder: startSort + idx,
      modifiers,
    };
  });
};

// ------------------------------------------------------------- ownership ---

export const loadOwnedOrder = async (
  restaurantId: string,
  orderId: string,
): Promise<OrderWithRelations> => {
  const order = await findOrderById(orderId);
  if (!order || order.deletedAt) {
    throw new Error(ORDER_NOT_FOUND);
  }
  if (order.restaurantId !== restaurantId) {
    throw new Error(ORDER_FORBIDDEN);
  }
  return order;
};

// --------------------------------------------------------------- use cases ---

export const createOrder = async (
  ctx: OrderContext,
  input: CreateOrderInput,
): Promise<OrderDTO> => {
  const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return mapOrder(existing);
  }
  const menu = await getMenu(ctx.restaurantId);
  const items = snapshotLines(menu, input.items, 0, "FIRED");
  const orderNumber = (await maxOrderNumber(ctx.restaurantId)) + 1;

  const order = await createOrderRepo({
    restaurantId: ctx.restaurantId,
    orderNumber,
    idempotencyKey: input.idempotencyKey,
    orderType: input.orderType,
    tableLabel: input.tableLabel ?? null,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    customerAddress: input.customerAddress ?? null,
    note: input.note ?? null,
    placedById: ctx.userId,
    items,
  });
  return mapOrder(order);
};

export const addItems = async (
  ctx: OrderContext,
  input: AddItemsInput,
): Promise<OrderDTO> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }
  const menu = await getMenu(ctx.restaurantId);
  const items = snapshotLines(menu, input.items, order.items.length, "UNSENT");
  const updated = await addOrderItems(input.orderId, items);
  return mapOrder(updated);
};

export const fireOrder = async (
  ctx: OrderContext,
  orderId: string,
): Promise<OrderDTO> => {
  const order = await loadOwnedOrder(ctx.restaurantId, orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }
  return mapOrder(await fireUnsentItems(orderId));
};

const assertLineOnOrder = (order: OrderWithRelations, itemId: string): void => {
  if (!order.items.some((i) => i.id === itemId)) {
    throw new Error(ORDER_ITEM_NOT_FOUND);
  }
};

export const serveLine = async (
  ctx: OrderContext,
  input: { orderId: string; itemId: string },
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.orderId);
  assertLineOnOrder(order, input.itemId);
  await setLineState(input.itemId, "SERVED");
};

export const voidLine = async (
  ctx: OrderContext,
  input: VoidLineInput,
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.orderId);
  assertLineOnOrder(order, input.itemId);
  await setLineState(input.itemId, "VOID", input.reason);
};

export const voidWholeOrder = async (
  ctx: OrderContext,
  input: VoidOrderInput,
): Promise<void> => {
  const order = await loadOwnedOrder(ctx.restaurantId, input.orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }
  await voidOrderRepo(input.orderId, ctx.userId, input.reason);
};

export const listOrders = async (
  restaurantId: string,
  statuses: OrderStatus[],
): Promise<OrderDTO[]> =>
  (await findOrdersByRestaurant(restaurantId, statuses)).map(mapOrder);

export const getOrder = async (
  restaurantId: string,
  orderId: string,
): Promise<OrderDTO> => mapOrder(await loadOwnedOrder(restaurantId, orderId));
