"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatTime } from "@/lib/format";
import type { OrderDTO, TodaySalesDTO } from "@/types/order";

type Tab = "OPEN" | "COMPLETED";

const activeCount = (lines: OrderDTO["lines"]) =>
  lines.filter((l) => l.state !== "VOID").reduce((s, l) => s + l.quantity, 0);

export function OrdersBoard({
  open,
  completed,
  sales,
}: {
  readonly open: readonly OrderDTO[];
  readonly completed: readonly OrderDTO[];
  readonly sales: TodaySalesDTO;
}) {
  const [tab, setTab] = useState<Tab>("OPEN");
  const orders = tab === "OPEN" ? open : completed;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Orders" description="Live tickets and today's settlements." />
        <Button render={<Link href="/dashboard/pos" />}>New order</Button>
      </div>

      {/* Today's sales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Net sales" value={formatCurrency(sales.gross)} />
        <Stat label="GST collected" value={formatCurrency(sales.tax)} />
        <Stat label="Orders" value={String(sales.orders)} />
        <Stat label="Voids" value={String(sales.voids)} />
      </div>
      {sales.byMode.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sales.byMode.map((m) => (
            <Badge key={m.mode} variant="secondary">
              {m.mode}: {formatCurrency(m.amount)} · {m.count}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "OPEN" ? "default" : "outline"}
          onClick={() => setTab("OPEN")}
        >
          Open ({open.length})
        </Button>
        <Button
          size="sm"
          variant={tab === "COMPLETED" ? "default" : "outline"}
          onClick={() => setTab("COMPLETED")}
        >
          Completed ({completed.length})
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {tab === "OPEN" ? "No open tickets." : "No settled orders today."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/dashboard/orders/${order.id}`}
                className="hover:border-primary flex flex-col gap-2 rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    #{order.orderNumber}
                    {order.invoiceNumber ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · Inv {order.invoiceNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatTime(order.createdAt)}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-sm">
                  <span>
                    {order.orderType.replace("_", "-")}
                    {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                    {order.customerName ? ` · ${order.customerName}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {tab === "COMPLETED"
                      ? formatCurrency(order.grandTotal)
                      : `${activeCount(order.lines)} items`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
