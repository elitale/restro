import {
  KITCHEN_ACTIVE_STATES,
  deriveKitchenStatus,
  kitchenAdvanceLabel,
} from "@/lib/kitchen";
import {
  advanceLineStates,
  findOrdersByRestaurant,
  type OrderWithRelations,
} from "@/repositories/order.repository";
import { ORDER_NOT_OPEN, loadOwnedOrder } from "@/services/order.service";
import type {
  KitchenTicketBatch,
  KitchenTicketDTO,
  KitchenTicketLine,
} from "@/types/kitchen";

type TicketItem = OrderWithRelations["items"][number];

const isActive = (state: string): boolean =>
  (KITCHEN_ACTIVE_STATES as readonly string[]).includes(state);

const mapLine = (item: TicketItem): KitchenTicketLine => ({
  id: item.id,
  name: item.name,
  variantName: item.variantName,
  quantity: item.quantity,
  lineNote: item.lineNote,
  modifiers: item.modifiers.map((m) => m.name),
  state: item.state as KitchenTicketLine["state"],
});

const toTicket = (order: OrderWithRelations): KitchenTicketDTO | null => {
  const active = order.items.filter((i) => isActive(i.state));
  if (active.length === 0) {
    return null;
  }

  // Group active lines by their exact firing time. The earliest batch is the
  // original ticket; anything fired later is an add-on.
  const byBatch = new Map<string, TicketItem[]>();
  for (const line of active) {
    const key = line.firedAt ? line.firedAt.toISOString() : "";
    const bucket = byBatch.get(key) ?? [];
    bucket.push(line);
    byBatch.set(key, bucket);
  }
  const keys = [...byBatch.keys()].sort();
  const batches: KitchenTicketBatch[] = keys.map((key, idx) => ({
    firedAt: key || null,
    isAddOn: idx > 0,
    isSelfOrder: (byBatch.get(key) ?? []).some(
      (l) => l.source === "SELF_ORDER",
    ),
    lines: (byBatch.get(key) ?? []).map(mapLine),
  }));

  const states = active.map((i) => i.state);
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    tableLabel: order.tableLabel,
    status: deriveKitchenStatus(states) ?? "READY",
    firstFiredAt: keys[0] || null,
    batches,
    advanceLabel: kitchenAdvanceLabel(states),
  };
};

/** Every OPEN order with at least one active kitchen line, oldest-fired first. */
export const listKitchenTickets = async (
  restaurantId: string,
): Promise<KitchenTicketDTO[]> => {
  const orders = await findOrdersByRestaurant(restaurantId, ["OPEN"]);
  return orders
    .map(toTicket)
    .filter((t): t is KitchenTicketDTO => t !== null)
    .sort((a, b) => (a.firstFiredAt ?? "").localeCompare(b.firstFiredAt ?? ""));
};

/**
 * Advance a whole ticket one step: FIRED lines start preparing, otherwise
 * PREPARING lines are marked ready. No-op once everything is prepared.
 */
export const advanceTicket = async (
  restaurantId: string,
  orderId: string,
): Promise<void> => {
  const order = await loadOwnedOrder(restaurantId, orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }
  const hasFired = order.items.some((i) => i.state === "FIRED");
  await advanceLineStates(
    orderId,
    hasFired ? "FIRED" : "PREPARING",
    hasFired ? "PREPARING" : "PREPARED",
  );
};

/** Waiter clears a ready ticket by marking its prepared lines served. */
export const markPickedUp = async (
  restaurantId: string,
  orderId: string,
): Promise<void> => {
  const order = await loadOwnedOrder(restaurantId, orderId);
  if (order.status !== "OPEN") {
    throw new Error(ORDER_NOT_OPEN);
  }
  await advanceLineStates(orderId, "PREPARED", "SERVED");
};
