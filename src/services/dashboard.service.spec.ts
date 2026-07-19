import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithRelations } from "@/repositories/order.repository";

vi.mock("@/repositories/order.repository", () => ({
  findSettledOrdersSince: vi.fn(),
  findOrdersByRestaurant: vi.fn(),
  countVoidedSince: vi.fn(),
  aggregateSettledBetween: vi.fn(),
}));
vi.mock("@/repositories/table.repository", () => ({
  findTablesByRestaurant: vi.fn(),
}));

import {
  aggregateSettledBetween,
  countVoidedSince,
  findOrdersByRestaurant,
  findSettledOrdersSince,
} from "@/repositories/order.repository";
import { findTablesByRestaurant } from "@/repositories/table.repository";
import { getDashboard, istMidnight, istParts } from "./dashboard.service";

// 2026-07-20T06:00:00Z = 11:30 IST on 2026-07-20.
const NOW = new Date("2026-07-20T06:00:00.000Z");

interface LineOpt {
  name?: string;
  quantity?: number;
  state?: string;
  unitPrice?: number;
}
const line = (o: LineOpt = {}) => ({
  name: o.name ?? "Tea",
  variantName: null,
  quantity: o.quantity ?? 1,
  state: o.state ?? "SERVED",
  unitPrice: o.unitPrice ?? 100,
  taxRate: 0,
  taxInclusive: false,
  isComp: false,
  modifiers: [],
});

interface OrderOpt {
  settledAt?: string;
  createdAt?: string;
  grandTotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  orderType?: string;
  tableId?: string | null;
  status?: string;
  items?: ReturnType<typeof line>[];
  payments?: { mode: string; amount: number }[];
}
const order = (o: OrderOpt = {}): OrderWithRelations =>
  ({
    id: Math.random().toString(36),
    orderNumber: 1,
    orderType: o.orderType ?? "DINE_IN",
    status: o.status ?? "COMPLETED",
    tableId: o.tableId ?? null,
    settledAt: o.settledAt ? new Date(o.settledAt) : null,
    createdAt: new Date(o.createdAt ?? o.settledAt ?? NOW.toISOString()),
    grandTotal: o.grandTotal ?? 0,
    taxTotal: o.taxTotal ?? 0,
    discountTotal: o.discountTotal ?? 0,
    items: o.items ?? [line()],
    payments: o.payments ?? [],
  }) as unknown as OrderWithRelations;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(countVoidedSince).mockResolvedValue(3);
  vi.mocked(aggregateSettledBetween).mockResolvedValue({ sum: 8000, count: 40 });
  vi.mocked(findTablesByRestaurant).mockResolvedValue([
    {},
    {},
    {},
    {},
    {},
  ] as never);
});

describe("istParts / istMidnight", () => {
  it("reads IST calendar parts across a UTC-day boundary", () => {
    // 18:30 UTC = 00:00 IST next day.
    expect(istParts(new Date("2026-07-19T18:30:00Z"))).toEqual({
      y: 2026,
      m: 7,
      day: 20,
    });
  });

  it("returns the UTC instant of IST midnight", () => {
    expect(istMidnight(2026, 7, 20).toISOString()).toBe(
      "2026-07-19T18:30:00.000Z",
    );
  });
});

describe("getDashboard", () => {
  it("derives today, yesterday, MTD, trend, top items, payment mix and open-now", async () => {
    vi.mocked(findSettledOrdersSince).mockResolvedValue([
      order({
        settledAt: "2026-07-20T05:00:00Z",
        grandTotal: 200,
        taxTotal: 10,
        orderType: "DINE_IN",
        items: [line({ name: "Tea", quantity: 2 })],
        payments: [{ mode: "CASH", amount: 200 }],
      }),
      order({
        settledAt: "2026-07-20T04:00:00Z",
        grandTotal: 300,
        orderType: "TAKEAWAY",
        items: [line({ name: "Coffee", quantity: 1 })],
        payments: [{ mode: "UPI", amount: 300 }],
      }),
      order({ settledAt: "2026-07-19T05:00:00Z", grandTotal: 150 }),
      order({ settledAt: "2026-07-05T05:00:00Z", grandTotal: 500 }),
    ]);
    vi.mocked(findOrdersByRestaurant).mockResolvedValue([
      order({
        status: "OPEN",
        createdAt: "2026-07-20T05:30:00Z",
        tableId: "t1",
        items: [line({ unitPrice: 100, quantity: 1, state: "FIRED" })],
      }),
      order({
        status: "OPEN",
        createdAt: "2026-07-20T05:50:00Z",
        tableId: "t2",
        items: [line({ unitPrice: 50, quantity: 2, state: "FIRED" })],
      }),
    ]);

    const d = await getDashboard("res_1", NOW);

    expect(d.today).toMatchObject({ sales: 500, orders: 2, aov: 250, tax: 10 });
    expect(d.yesterdaySales).toBe(150);
    expect(d.month).toMatchObject({ sales: 1150, orders: 4, aov: 287.5 });
    expect(d.lastMonthSales).toBe(8000);
    expect(d.voidsToday).toBe(3);

    expect(d.openNow).toEqual({ count: 2, value: 200, oldestMinutes: 30 });
    expect(d.occupancy).toEqual({ occupied: 2, total: 5 });

    expect(d.paymentMixToday).toEqual([
      { mode: "CASH", amount: 200 },
      { mode: "UPI", amount: 300 },
    ]);
    expect(d.topItemsToday).toEqual([
      { name: "Tea", quantity: 2 },
      { name: "Coffee", quantity: 1 },
    ]);
    expect(d.orderTypeToday).toEqual([
      { type: "DINE_IN", orders: 1 },
      { type: "TAKEAWAY", orders: 1 },
      { type: "DELIVERY", orders: 0 },
    ]);

    // Trend runs day 1..20 with sales on days 5, 19, 20.
    expect(d.trend).toHaveLength(20);
    expect(d.trend.find((t) => t.label === "5")?.sales).toBe(500);
    expect(d.trend.find((t) => t.label === "20")?.sales).toBe(500);
    expect(d.trend.find((t) => t.label === "12")?.sales).toBe(0);
  });

  it("handles an empty day without dividing by zero", async () => {
    vi.mocked(findSettledOrdersSince).mockResolvedValue([]);
    vi.mocked(findOrdersByRestaurant).mockResolvedValue([]);

    const d = await getDashboard("res_1", NOW);

    expect(d.today).toEqual({ sales: 0, orders: 0, aov: 0, tax: 0, discount: 0 });
    expect(d.openNow).toEqual({ count: 0, value: 0, oldestMinutes: null });
    expect(d.occupancy).toEqual({ occupied: 0, total: 5 });
  });
});
