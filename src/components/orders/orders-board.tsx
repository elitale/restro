"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { TableSettleDialog } from "@/components/orders/table-settle-dialog";
import { orderRunningTotal } from "@/components/pos/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KitchenStatusBadge } from "@/components/shared/kitchen-status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { SelfOrderBadge } from "@/components/shared/self-order-badge";
import { SoundToggle } from "@/components/shared/sound-toggle";
import { useAnnouncer } from "@/hooks/use-announcer";
import {
  alertSignatureMap,
  newOrderAlerts,
  newOrderPhrase,
  selfOrderAlertPhrase,
} from "@/lib/announce";
import { formatCurrency, formatTime } from "@/lib/format";
import type { OrderDTO, TodaySalesDTO } from "@/types/order";

type Tab = "OPEN" | "COMPLETED";

const activeCount = (lines: OrderDTO["lines"]) =>
  lines.filter((l) => l.state !== "VOID").reduce((s, l) => s + l.quantity, 0);

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

interface TableGroup {
  readonly key: string;
  readonly tableLabel: string | null;
  readonly orders: readonly OrderDTO[];
  readonly total: number;
}

/** Group open orders by table, preserving first-seen order. Orders without a
 *  table stay on their own. */
const groupByTable = (orders: readonly OrderDTO[]): TableGroup[] => {
  const map = new Map<string, OrderDTO[]>();
  for (const order of orders) {
    const key =
      order.tableId ??
      (order.tableLabel ? `label:${order.tableLabel}` : `solo:${order.id}`);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(order);
    } else {
      map.set(key, [order]);
    }
  }
  return [...map.entries()].map(([key, group]) => ({
    key,
    tableLabel: group[0]?.tableLabel ?? null,
    orders: group,
    total: round2(group.reduce((s, o) => s + orderRunningTotal(o), 0)),
  }));
};

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
  const [settleGroup, setSettleGroup] = useState<TableGroup | null>(null);

  const router = useRouter();
  const { supported, enabled, toggle, announce } = useAnnouncer();
  const seenRef = useRef<Map<string, number> | null>(null);

  const groups = useMemo(() => groupByTable(open), [open]);

  // Poll every 10s so new orders surface hands-free.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [router]);

  // Voice-announce new orders (self-orders get a distinct phrase) and guest
  // add-ons to an existing table order.
  useEffect(() => {
    const sigs = open.map((o) => ({
      id: o.id,
      selfOrderLines: o.lines.filter(
        (l) => l.state !== "VOID" && l.source === "SELF_ORDER",
      ).length,
    }));
    if (seenRef.current === null) {
      seenRef.current = alertSignatureMap(sigs);
      return;
    }
    const alerts = newOrderAlerts(seenRef.current, sigs);
    seenRef.current = alertSignatureMap(sigs);
    const alert = alerts[0];
    if (!alert) {
      return;
    }
    const order = open.find((o) => o.id === alert.id);
    if (order) {
      announce(
        alert.isSelfOrder ? selfOrderAlertPhrase(order) : newOrderPhrase(order),
        "beep",
      );
    }
  }, [open, announce]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Orders" description="Live tickets and today's settlements." />
        <div className="flex items-center gap-2">
          <SoundToggle
            supported={supported}
            enabled={enabled}
            onToggle={toggle}
          />
          <Button render={<Link href="/dashboard/pos" />}>New order</Button>
        </div>
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

      {tab === "COMPLETED" ? (
        completed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No settled orders today.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((order) => (
              <OrderCard key={order.id} order={order} tab={tab} />
            ))}
          </ul>
        )
      ) : open.length === 0 ? (
        <p className="text-muted-foreground text-sm">No open tickets.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) =>
            group.orders.length >= 2 && group.tableLabel ? (
              <div
                key={group.key}
                className="flex flex-col gap-3 rounded-xl border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {group.tableLabel} · {group.orders.length} orders ·{" "}
                    <span className="tabular-nums">
                      {formatCurrency(group.total)}
                    </span>
                  </span>
                  <Button size="sm" onClick={() => setSettleGroup(group)}>
                    Settle table
                  </Button>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.orders.map((order) => (
                    <OrderCard key={order.id} order={order} tab={tab} />
                  ))}
                </ul>
              </div>
            ) : (
              <ul
                key={group.key}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {group.orders.map((order) => (
                  <OrderCard key={order.id} order={order} tab={tab} />
                ))}
              </ul>
            ),
          )}
        </div>
      )}

      {settleGroup ? (
        <TableSettleDialog
          tableLabel={settleGroup.tableLabel ?? "table"}
          orders={settleGroup.orders}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSettleGroup(null);
            }
          }}
          onSettled={() => setSettleGroup(null)}
        />
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  tab,
}: {
  readonly order: OrderDTO;
  readonly tab: Tab;
}) {
  return (
    <li>
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
          <span className="flex items-center gap-2">
            {tab === "OPEN" ? (
              <KitchenStatusBadge states={order.lines.map((l) => l.state)} />
            ) : null}
            {order.lines.some(
              (l) => l.state !== "VOID" && l.source === "SELF_ORDER",
            ) ? (
              <SelfOrderBadge />
            ) : null}
            <span className="tabular-nums">
              {tab === "COMPLETED"
                ? formatCurrency(order.grandTotal)
                : `${activeCount(order.lines)} items`}
            </span>
          </span>
        </div>
      </Link>
    </li>
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
