import { detectAllergiesInText } from "@/lib/allergies";
import type { MobileTokenPayload } from "@/lib/mobile-session";
import { prisma } from "@/lib/prisma";
import type {
    MobileCreateOrderInput,
    MobileEditOrderInput,
    MobileOrderAction,
    MobileOrderChannel,
} from "@/lib/validators/mobile-orders";
import {
    addOrderItems,
    advanceLineStates,
    createOrder,
    findOrderById,
    findOrdersByRestaurant,
    maxOrderNumber,
    ORDER_INCLUDE,
    type OrderLineWriteData,
    type OrderWithRelations,
} from "@/repositories/order.repository";

import { sendToRoles } from "./push-dispatch.service";

// ---------------------------------------------------------------------------
// Error constants \u2014 mapped to HTTP in `lib/mobile-api.ts`.
// ---------------------------------------------------------------------------

export const MOBILE_ORDER_NOT_FOUND = "MOBILE_ORDER_NOT_FOUND";
export const MOBILE_ORDER_NOT_ALLOWED = "MOBILE_ORDER_NOT_ALLOWED";
export const MOBILE_ORDER_INVALID_TRANSITION =
  "MOBILE_ORDER_INVALID_TRANSITION";
export const MOBILE_ORDER_NO_RESTAURANT = "MOBILE_ORDER_NO_RESTAURANT";
export const MOBILE_ORDER_DEDUPE = "MOBILE_ORDER_DEDUPE";
export const MOBILE_ORDER_FORBIDDEN_ROLE = "MOBILE_ORDER_FORBIDDEN_ROLE";

// ---------------------------------------------------------------------------
// Client-facing DTO
// ---------------------------------------------------------------------------

export type MobileOrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "served"
  | "settled";
export type MobileOrderPriority = "normal" | "late" | "urgent";

export interface MobileOrderItemDto {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly priceRupees: number;
  readonly modifiers: string[];
  readonly station: string | null;
}

export interface MobileOrderDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly channel: MobileOrderChannel;
  readonly status: MobileOrderStatus;
  readonly priority: MobileOrderPriority;
  readonly tableLabel: string | null;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly waiterName: string | null;
  readonly aggregatorName: string | null;
  readonly items: MobileOrderItemDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly totalAmount: string | null;
  readonly note: string | null;
  readonly estimatedReadyAt: string | null;
  readonly driverArrived: boolean | null;
  readonly allergies: string[];
}

// ---------------------------------------------------------------------------
// Role \u2192 action allow-list. Server-enforced.
// ---------------------------------------------------------------------------

const WAITER_ACTIONS = new Set<MobileOrderAction>([
  "acknowledge",
  "mark-served",
  "escalate",
]);
const KITCHEN_ACTIONS = new Set<MobileOrderAction>([
  "start-cooking",
  "mark-ready",
  "recall",
]);
const MANAGER_ROLES = new Set([
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
  "MANAGEMENT",
]);

const isActionAllowed = (role: string, action: MobileOrderAction): boolean => {
  if (MANAGER_ROLES.has(role)) return true;
  if (role === "WAITER") return WAITER_ACTIONS.has(action);
  if (role === "KITCHEN") return KITCHEN_ACTIONS.has(action);
  return false;
};

// ---------------------------------------------------------------------------
// Mappers: DB \u2192 mobile DTO
// ---------------------------------------------------------------------------

const CHANNEL_TO_MOBILE: Record<string, MobileOrderChannel> = {
  DINE_IN: "dine-in",
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
};

const MOBILE_TO_CHANNEL: Record<
  MobileOrderChannel,
  "DINE_IN" | "TAKEAWAY" | "DELIVERY"
> = {
  "dine-in": "DINE_IN",
  takeaway: "TAKEAWAY",
  delivery: "DELIVERY",
  aggregator: "DELIVERY",
};

// Derive the mobile status from the order status + item line states.
// A COMPLETED order is "settled". OPEN orders are inspected item-by-item.
const deriveMobileStatus = (order: OrderWithRelations): MobileOrderStatus => {
  if (order.status === "COMPLETED") return "settled";
  if (order.status === "VOID") return "settled";
  const states = order.items
    .filter((i) => i.state !== "VOID")
    .map((i) => i.state);
  if (states.length === 0) return "new";
  if (states.every((s) => s === "SERVED")) return "served";
  if (
    states.every((s) => s === "PREPARED" || s === "SERVED") &&
    states.includes("PREPARED")
  ) {
    return "ready";
  }
  if (states.some((s) => s === "PREPARING" || s === "FIRED"))
    return "preparing";
  return "new";
};

// Rough SLA. Kept simple; refine when we have real prep-time data.
const derivePriority = (
  order: OrderWithRelations,
  mobileStatus: MobileOrderStatus,
): MobileOrderPriority => {
  const now = Date.now();
  const ageMinutes = (now - order.createdAt.getTime()) / 60_000;
  if (mobileStatus === "ready") {
    // Food is on the pass. Every minute it sits = staler.
    const readyItem = order.items.find((i) => i.state === "PREPARED");
    if (readyItem && readyItem.firedAt) {
      const readyForMin = (now - readyItem.firedAt.getTime()) / 60_000;
      if (readyForMin > 5) return "urgent";
    }
    return "normal";
  }
  if (mobileStatus === "preparing" && ageMinutes > 25) return "urgent";
  if (mobileStatus === "preparing" && ageMinutes > 15) return "late";
  if (mobileStatus === "new" && ageMinutes > 10) return "late";
  return "normal";
};

const formatRupees = (n: number): string =>
  "\u20B9" + n.toLocaleString("en-IN");

const decimalToNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
};

const mapItemModifiers = (
  item: OrderWithRelations["items"][number],
): string[] => item.modifiers.map((m) => m.name);

const mapItem = (
  item: OrderWithRelations["items"][number],
): MobileOrderItemDto => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  priceRupees: decimalToNumber(item.unitPrice),
  modifiers: mapItemModifiers(item),
  station: null,
});

export const toMobileOrderDto = (order: OrderWithRelations): MobileOrderDto => {
  const status = deriveMobileStatus(order);
  const priority = derivePriority(order, status);
  const total = decimalToNumber(order.grandTotal);
  const subtotal = decimalToNumber(order.subtotal);
  const amount = total > 0 ? total : subtotal;
  return {
    id: order.id,
    orderNumber: `T-${order.orderNumber}`,
    channel: CHANNEL_TO_MOBILE[order.orderType] ?? "dine-in",
    status,
    priority,
    tableLabel: order.tableLabel,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    waiterName: null, // TODO Phase 1: join Staff or User by placedById
    aggregatorName: null,
    items: order.items.filter((i) => i.state !== "VOID").map(mapItem),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    totalAmount: amount > 0 ? formatRupees(amount) : null,
    note: order.note,
    estimatedReadyAt: null,
    driverArrived: null,
    allergies: [], // Phase 1: server-side allergy extraction. Phase 0: client parses `note`.
  };
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const requireRestaurant = (auth: MobileTokenPayload): string => {
  if (!auth.restaurantId) throw new Error(MOBILE_ORDER_NO_RESTAURANT);
  return auth.restaurantId;
};

const summariseItems = (order: OrderWithRelations): string =>
  order.items
    .filter((i) => i.state !== "VOID")
    .map((i) => `${i.quantity}\u00D7 ${i.name}`)
    .join(" \u00B7 ");

const dispatchNewOrderPush = async (
  order: OrderWithRelations,
): Promise<void> => {
  const label = order.tableLabel ?? `Order #${order.orderNumber}`;
  const allergies = detectAllergiesInText(order.note);
  const suffix =
    allergies.length > 0 ? ` \u00B7 \u26A0 ${allergies.join(", ")}` : "";
  await sendToRoles(order.restaurantId, ["KITCHEN"], {
    title: `New order \u2014 ${label}`,
    body: summariseItems(order) + suffix,
    channelId: "new-orders",
    categoryId: "newOrder",
    data: {
      type: "new-order",
      orderId: order.id,
      url: `elitalerestaurantstaff:///orders/${order.id}`,
    },
  });
};

const dispatchFoodReadyPush = async (
  order: OrderWithRelations,
): Promise<void> => {
  const label = order.tableLabel ?? `Order #${order.orderNumber}`;
  const allergies = detectAllergiesInText(order.note);
  const suffix =
    allergies.length > 0 ? ` \u00B7 \u26A0 ${allergies.join(", ")}` : "";
  // Alert waiters + managers so the runner can go NOW.
  await sendToRoles(
    order.restaurantId,
    ["WAITER", "MANAGER", "MANAGEMENT", "ADMIN", "SUPER_ADMIN"],
    {
      title: `${label} \u00B7 Ready`,
      body: summariseItems(order) + suffix,
      channelId: "food-ready",
      categoryId: "foodReady",
      data: {
        type: "food-ready",
        orderId: order.id,
        url: `elitalerestaurantstaff:///orders/${order.id}`,
      },
    },
  );
};

export interface ListMobileOrdersOptions {
  readonly status?: "live" | "settled" | "all";
}

export const listMobileOrders = async (
  auth: MobileTokenPayload,
  options: ListMobileOrdersOptions = {},
): Promise<{ orders: MobileOrderDto[]; serverTime: string }> => {
  const restaurantId = requireRestaurant(auth);
  const scope = options.status ?? "live";
  const statuses =
    scope === "settled"
      ? (["COMPLETED"] as const)
      : scope === "all"
        ? (["OPEN", "COMPLETED"] as const)
        : (["OPEN"] as const);
  const rows = await findOrdersByRestaurant(restaurantId, [...statuses]);
  return {
    orders: rows.map(toMobileOrderDto),
    serverTime: new Date().toISOString(),
  };
};

export const getMobileOrder = async (
  auth: MobileTokenPayload,
  id: string,
): Promise<MobileOrderDto> => {
  const restaurantId = requireRestaurant(auth);
  const row = await findOrderById(id);
  if (!row || row.restaurantId !== restaurantId) {
    throw new Error(MOBILE_ORDER_NOT_FOUND);
  }
  return toMobileOrderDto(row);
};

// A shared line-writer built from mobile input. Phase 0 accepts client-
// provided name + priceRupees directly \u2014 the menu link is Phase 1.
const buildLine = (
  input: MobileCreateOrderInput["items"][number],
  sortOrder: number,
): OrderLineWriteData => ({
  menuItemId: input.menuItemId ?? null,
  variantId: null,
  name: input.name,
  variantName: null,
  unitPrice: input.priceRupees ?? 0,
  quantity: input.quantity,
  lineNote:
    input.modifiers && input.modifiers.length > 0
      ? input.modifiers.join(", ")
      : null,
  taxRate: 0,
  taxKind: "NONE",
  taxInclusive: false,
  isComp: false,
  compReason: null,
  state: "UNSENT",
  source: "STAFF",
  sortOrder,
  modifiers: (input.modifiers ?? []).map((m) => ({
    modifierId: null,
    name: m,
    priceDelta: 0,
  })),
});

export const createMobileOrder = async (
  auth: MobileTokenPayload,
  input: MobileCreateOrderInput,
): Promise<MobileOrderDto> => {
  const restaurantId = requireRestaurant(auth);

  // Dedupe on clientRequestId via the `idempotencyKey` unique.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.clientRequestId },
    include: ORDER_INCLUDE,
  });
  if (existing) return toMobileOrderDto(existing);

  const orderNumber = (await maxOrderNumber(restaurantId)) + 1;

  const created = await createOrder({
    restaurantId,
    orderNumber,
    idempotencyKey: input.clientRequestId,
    orderType: MOBILE_TO_CHANNEL[input.channel],
    tableLabel: input.tableLabel,
    tableId: null,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    customerAddress: null,
    note: input.note ?? null,
    placedById: auth.kind === "manager" ? auth.subjectId : null,
    placedByStaffId: auth.kind === "staff" ? auth.subjectId : null,
    items: input.items.map(buildLine),
  });

  // Fire-and-forget notification to the kitchen line. Never blocks the write.
  void dispatchNewOrderPush(created).catch((e) =>
    console.warn("[mobile-orders] new-order push failed", e),
  );

  return toMobileOrderDto(created);
};

export const editMobileOrder = async (
  auth: MobileTokenPayload,
  orderId: string,
  input: MobileEditOrderInput,
): Promise<MobileOrderDto> => {
  const restaurantId = requireRestaurant(auth);
  const existing = await findOrderById(orderId);
  if (!existing || existing.restaurantId !== restaurantId) {
    throw new Error(MOBILE_ORDER_NOT_FOUND);
  }

  const isWaiter = auth.role === "WAITER";
  const wantsRemove = (input.removeItemIds?.length ?? 0) > 0;
  const wantsUpdate = (input.updateItems?.length ?? 0) > 0;
  if (isWaiter && (wantsRemove || wantsUpdate)) {
    throw new Error(MOBILE_ORDER_FORBIDDEN_ROLE);
  }

  await prisma.$transaction(async (tx) => {
    if (input.note !== undefined || input.customerPhone !== undefined) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.customerPhone !== undefined
            ? { customerPhone: input.customerPhone }
            : {}),
        },
      });
    }
    if (wantsUpdate) {
      for (const upd of input.updateItems ?? []) {
        const owned = await tx.orderItem.findFirst({
          where: { id: upd.id, orderId },
          select: { id: true },
        });
        if (!owned) continue;
        await tx.orderItem.update({
          where: { id: upd.id },
          data: {
            ...(upd.quantity !== undefined ? { quantity: upd.quantity } : {}),
            ...(upd.modifiers
              ? {
                  modifiers: {
                    deleteMany: {},
                    create: upd.modifiers.map((m) => ({
                      modifierId: null,
                      name: m,
                      priceDelta: 0,
                    })),
                  },
                }
              : {}),
          },
        });
      }
    }
    if (wantsRemove) {
      for (const rm of input.removeItemIds ?? []) {
        const owned = await tx.orderItem.findFirst({
          where: { id: rm.id, orderId },
          select: { id: true },
        });
        if (!owned) continue;
        await tx.orderItem.update({
          where: { id: rm.id },
          data: { state: "VOID", voidReason: rm.reason },
        });
      }
    }
  });

  if (input.addItems && input.addItems.length > 0) {
    const currentMax = existing.items.reduce(
      (max, i) => (i.sortOrder > max ? i.sortOrder : max),
      0,
    );
    const lines = input.addItems.map((it, i) =>
      buildLine(it, currentMax + 1 + i),
    );
    await addOrderItems(orderId, lines);
  }

  const refreshed = await findOrderById(orderId);
  if (!refreshed) throw new Error(MOBILE_ORDER_NOT_FOUND);
  return toMobileOrderDto(refreshed);
};

// State-machine transitions for the 7 mobile actions. Phase 0 sweeps every
// applicable item to the next state; refined per-item control is Phase 1.
export const dispatchMobileOrderAction = async (
  auth: MobileTokenPayload,
  orderId: string,
  action: MobileOrderAction,
  reason: string | null,
): Promise<MobileOrderDto> => {
  const restaurantId = requireRestaurant(auth);
  if (!isActionAllowed(auth.role, action)) {
    throw new Error(MOBILE_ORDER_FORBIDDEN_ROLE);
  }
  const existing = await findOrderById(orderId);
  if (!existing || existing.restaurantId !== restaurantId) {
    throw new Error(MOBILE_ORDER_NOT_FOUND);
  }
  if (existing.status !== "OPEN" && action !== "escalate") {
    throw new Error(MOBILE_ORDER_INVALID_TRANSITION);
  }

  switch (action) {
    case "acknowledge": {
      await advanceLineStates(orderId, "UNSENT", "FIRED");
      break;
    }
    case "start-cooking": {
      await advanceLineStates(orderId, "FIRED", "PREPARING");
      break;
    }
    case "mark-ready": {
      await advanceLineStates(orderId, "PREPARING", "PREPARED");
      const readyOrder = await findOrderById(orderId);
      if (readyOrder) {
        void dispatchFoodReadyPush(readyOrder).catch((e) =>
          console.warn("[mobile-orders] food-ready push failed", e),
        );
      }
      break;
    }
    case "mark-served": {
      await advanceLineStates(orderId, "PREPARED", "SERVED");
      // If every non-void item is now served, mark the order COMPLETED.
      const refreshed = await findOrderById(orderId);
      if (
        refreshed &&
        refreshed.items
          .filter((i) => i.state !== "VOID")
          .every((i) => i.state === "SERVED")
      ) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "COMPLETED", settledAt: new Date() },
        });
      }
      break;
    }
    case "recall": {
      await advanceLineStates(orderId, "SERVED", "PREPARED");
      break;
    }
    case "escalate": {
      // No state change; recorded via reason on the audit log (Phase 1).
      console.log(
        `[mobile-orders] escalate ord=${orderId} by=${auth.subjectId} reason=${reason ?? ""}`,
      );
      break;
    }
    case "approve": {
      // Reserved for void approvals in Phase 1.
      break;
    }
  }

  const refreshed = await findOrderById(orderId);
  if (!refreshed) throw new Error(MOBILE_ORDER_NOT_FOUND);
  return toMobileOrderDto(refreshed);
};
