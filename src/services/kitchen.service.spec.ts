import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";
import {
  advanceLineStates,
  findOrdersByRestaurant,
} from "@/repositories/order.repository";
import { loadOwnedOrder } from "@/services/order.service";
import {
  advanceTicket,
  listKitchenTickets,
  markPickedUp,
} from "@/services/kitchen.service";

vi.mock("@/repositories/order.repository", () => ({
  findOrdersByRestaurant: vi.fn(),
  advanceLineStates: vi.fn(),
}));

vi.mock("@/services/order.service", () => ({
  loadOwnedOrder: vi.fn(),
  ORDER_NOT_OPEN: "ORDER_NOT_OPEN",
}));

const findOrdersMock = vi.mocked(findOrdersByRestaurant);
const advanceLinesMock = vi.mocked(advanceLineStates);
const loadOwnedMock = vi.mocked(loadOwnedOrder);

interface LineOptions {
  id?: string;
  name?: string;
  state?: string;
  firedAt?: Date | null;
  modifiers?: string[];
  quantity?: number;
  source?: string;
}

const line = (opts: LineOptions = {}): Record<string, unknown> => ({
  id: opts.id ?? "l1",
  name: opts.name ?? "Paneer Tikka",
  variantName: null,
  quantity: opts.quantity ?? 1,
  lineNote: null,
  state: opts.state ?? "FIRED",
  source: opts.source ?? "STAFF",
  firedAt: opts.firedAt === undefined ? new Date("2026-01-01T10:00:00Z") : opts.firedAt,
  modifiers: (opts.modifiers ?? []).map((name) => ({ name })),
});

const order = (
  id: string,
  items: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): OrderWithRelations =>
  ({
    id,
    orderNumber: 5,
    orderType: "DINE_IN",
    tableLabel: "T1",
    status: "OPEN",
    items,
    ...overrides,
  }) as unknown as OrderWithRelations;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listKitchenTickets", () => {
  it("excludes orders with no active kitchen lines", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [line({ state: "SERVED" }), line({ state: "VOID" })]),
    ]);

    const tickets = await listKitchenTickets("r1");

    expect(findOrdersMock).toHaveBeenCalledWith("r1", ["OPEN"]);
    expect(tickets).toHaveLength(0);
  });

  it("derives WAITING/Start for a freshly fired ticket", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [
        line({ id: "a", state: "FIRED", modifiers: ["No onion"] }),
        line({ id: "b", state: "FIRED" }),
      ]),
    ]);

    const [ticket] = await listKitchenTickets("r1");

    expect(ticket.status).toBe("WAITING");
    expect(ticket.advanceLabel).toBe("Start");
    expect(ticket.batches).toHaveLength(1);
    expect(ticket.batches[0].isAddOn).toBe(false);
    expect(ticket.batches[0].isSelfOrder).toBe(false);
    expect(ticket.batches[0].lines[0].modifiers).toEqual(["No onion"]);
  });

  it("flags a batch fired by a guest as self-order", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [line({ state: "FIRED", source: "SELF_ORDER" })]),
    ]);

    const [ticket] = await listKitchenTickets("r1");

    expect(ticket.batches[0].isSelfOrder).toBe(true);
  });

  it("derives PREPARING/Mark ready for a mixed ticket", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [
        line({ id: "a", state: "PREPARING" }),
        line({ id: "b", state: "PREPARED" }),
      ]),
    ]);

    const [ticket] = await listKitchenTickets("r1");

    expect(ticket.status).toBe("PREPARING");
    expect(ticket.advanceLabel).toBe("Mark ready");
  });

  it("derives READY with no advance label when all prepared", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [line({ state: "PREPARED" })]),
    ]);

    const [ticket] = await listKitchenTickets("r1");

    expect(ticket.status).toBe("READY");
    expect(ticket.advanceLabel).toBeNull();
  });

  it("splits later-fired lines into a flagged add-on batch", async () => {
    findOrdersMock.mockResolvedValue([
      order("o1", [
        line({ id: "a", state: "PREPARED", firedAt: new Date("2026-01-01T10:00:00Z") }),
        line({ id: "b", state: "FIRED", firedAt: new Date("2026-01-01T10:30:00Z") }),
      ]),
    ]);

    const [ticket] = await listKitchenTickets("r1");

    expect(ticket.batches).toHaveLength(2);
    expect(ticket.batches[0].isAddOn).toBe(false);
    expect(ticket.batches[1].isAddOn).toBe(true);
    expect(ticket.batches[1].lines[0].id).toBe("b");
    // a fired add-on re-triggers Start
    expect(ticket.advanceLabel).toBe("Start");
    expect(ticket.status).toBe("PREPARING");
  });

  it("orders tickets oldest-fired first", async () => {
    findOrdersMock.mockResolvedValue([
      order("newer", [line({ firedAt: new Date("2026-01-01T12:00:00Z") })]),
      order("older", [line({ firedAt: new Date("2026-01-01T09:00:00Z") })]),
    ]);

    const tickets = await listKitchenTickets("r1");

    expect(tickets.map((t) => t.orderId)).toEqual(["older", "newer"]);
  });
});

describe("advanceTicket", () => {
  it("starts fired lines when any remain", async () => {
    loadOwnedMock.mockResolvedValue(
      order("o1", [line({ state: "FIRED" }), line({ state: "PREPARING" })]),
    );

    await advanceTicket("r1", "o1");

    expect(loadOwnedMock).toHaveBeenCalledWith("r1", "o1");
    expect(advanceLinesMock).toHaveBeenCalledWith("o1", "FIRED", "PREPARING");
  });

  it("marks preparing lines ready when nothing is fired", async () => {
    loadOwnedMock.mockResolvedValue(
      order("o1", [line({ state: "PREPARING" }), line({ state: "PREPARED" })]),
    );

    await advanceTicket("r1", "o1");

    expect(advanceLinesMock).toHaveBeenCalledWith("o1", "PREPARING", "PREPARED");
  });

  it("rejects when the order is not open", async () => {
    loadOwnedMock.mockResolvedValue(
      order("o1", [line({ state: "FIRED" })], { status: "COMPLETED" }),
    );

    await expect(advanceTicket("r1", "o1")).rejects.toThrow("ORDER_NOT_OPEN");
    expect(advanceLinesMock).not.toHaveBeenCalled();
  });
});

describe("markPickedUp", () => {
  it("moves prepared lines to served", async () => {
    loadOwnedMock.mockResolvedValue(
      order("o1", [line({ state: "PREPARED" })]),
    );

    await markPickedUp("r1", "o1");

    expect(advanceLinesMock).toHaveBeenCalledWith("o1", "PREPARED", "SERVED");
  });

  it("rejects when the order is not open", async () => {
    loadOwnedMock.mockResolvedValue(
      order("o1", [line({ state: "PREPARED" })], { status: "VOID" }),
    );

    await expect(markPickedUp("r1", "o1")).rejects.toThrow("ORDER_NOT_OPEN");
    expect(advanceLinesMock).not.toHaveBeenCalled();
  });
});
