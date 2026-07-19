import Link from "next/link";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { Delta, StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { DashboardDTO } from "@/types/dashboard";

const deltaPct = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

const ageClass = (mins: number | null): string =>
  mins === null
    ? ""
    : mins >= 45
      ? "text-red-700"
      : mins >= 30
        ? "text-amber-700"
        : "text-emerald-700";

const MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};
const TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

export function DashboardView({
  data,
  lowStock,
}: {
  readonly data: DashboardDTO;
  readonly lowStock: number;
}) {
  const paymentsTotal = data.paymentMixToday.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <AutoRefresh />

      {lowStock > 0 ? (
        <Link
          href="/dashboard/inventory"
          className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            <strong>{lowStock}</strong> inventory item
            {lowStock === 1 ? "" : "s"} at or below reorder level.
          </span>
          <span className="font-medium underline">View inventory</span>
        </Link>
      ) : null}

      {/* Today */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">Today</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sales today"
            value={formatCurrency(data.today.sales)}
            footer={
              <Delta
                pct={deltaPct(data.today.sales, data.yesterdaySales)}
                label="vs yesterday"
              />
            }
          />
          <StatCard
            label="Orders today"
            value={String(data.today.orders)}
            footer={
              <span className="text-muted-foreground">
                Avg ticket {formatCurrency(data.today.aov)}
              </span>
            }
          />
          <StatCard
            label="Open now"
            value={formatCurrency(data.openNow.value)}
            footer={
              <span className="text-muted-foreground">
                {data.openNow.count} open
                {data.openNow.oldestMinutes !== null ? (
                  <>
                    {" · oldest "}
                    <span className={ageClass(data.openNow.oldestMinutes)}>
                      {data.openNow.oldestMinutes}m
                    </span>
                  </>
                ) : null}
              </span>
            }
          />
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Payments today</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatCurrency(paymentsTotal)}
              </CardTitle>
            </CardHeader>
            <CardFooter className="text-sm">
              {data.paymentMixToday.length === 0 ? (
                <span className="text-muted-foreground">No payments yet</span>
              ) : (
                <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {data.paymentMixToday.map((m) => (
                    <span key={m.mode}>
                      {MODE_LABEL[m.mode] ?? m.mode} {formatCurrency(m.amount)}
                    </span>
                  ))}
                </span>
              )}
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* This month */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">This month</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Month sales"
            value={formatCurrency(data.month.sales)}
            footer={
              <Delta
                pct={deltaPct(data.month.sales, data.lastMonthSales)}
                label="vs last month"
              />
            }
          />
          <StatCard
            label="Month orders"
            value={String(data.month.orders)}
            footer={
              <span className="text-muted-foreground">
                Avg ticket {formatCurrency(data.month.aov)}
              </span>
            }
          />
          <StatCard
            label="Tables seated"
            value={`${data.occupancy.occupied}/${data.occupancy.total}`}
            footer={
              <span className="text-muted-foreground">Occupied right now</span>
            }
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily sales</CardTitle>
            <CardDescription>Settled sales per day this month</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={data.trend} />
          </CardContent>
        </Card>
      </section>

      {/* Detail */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top items today</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItemsToday.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales yet today.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.topItemsToday.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{it.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      ×{it.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today detail</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>GST {formatCurrency(data.today.tax)}</span>
              <span>Discounts {formatCurrency(data.today.discount)}</span>
              <span>
                Voids{" "}
                <span className={data.voidsToday > 0 ? "text-amber-700" : ""}>
                  {data.voidsToday}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.orderTypeToday.map((t) => (
                <span
                  key={t.type}
                  className="bg-muted rounded-full px-2.5 py-1 text-xs"
                >
                  {TYPE_LABEL[t.type]} {t.orders}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
