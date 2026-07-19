export interface DashboardMetrics {
  readonly sales: number;
  readonly orders: number;
  readonly aov: number;
  readonly tax: number;
  readonly discount: number;
}

export interface DashboardOpenNow {
  readonly count: number;
  readonly value: number;
  readonly oldestMinutes: number | null;
}

export interface DashboardOccupancy {
  readonly occupied: number;
  readonly total: number;
}

export interface DashboardPaymentSlice {
  readonly mode: string;
  readonly amount: number;
}

export interface DashboardOrderTypeSlice {
  readonly type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  readonly orders: number;
}

export interface DashboardTrendPoint {
  /** IST calendar day, "YYYY-MM-DD". */
  readonly date: string;
  /** Day-of-month label for the axis. */
  readonly label: string;
  readonly sales: number;
}

export interface DashboardTopItem {
  readonly name: string;
  readonly quantity: number;
}

export interface DashboardDTO {
  readonly today: DashboardMetrics;
  readonly yesterdaySales: number;
  readonly month: DashboardMetrics;
  readonly lastMonthSales: number;
  readonly openNow: DashboardOpenNow;
  readonly occupancy: DashboardOccupancy;
  readonly voidsToday: number;
  readonly paymentMixToday: readonly DashboardPaymentSlice[];
  readonly orderTypeToday: readonly DashboardOrderTypeSlice[];
  readonly trend: readonly DashboardTrendPoint[];
  readonly topItemsToday: readonly DashboardTopItem[];
}
