"use client";

import { useTransition } from "react";
import Link from "next/link";

import { LogOutIcon, PlusIcon } from "lucide-react";

import { staffLogoutAction } from "@/actions/staff-auth.actions";
import { orderRunningTotal } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import type { OrderDTO } from "@/types/order";

const minutesAgo = (iso: string): string => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return `${mins} min`;
};

const orderTitle = (order: OrderDTO): string =>
  order.orderType === "DINE_IN"
    ? order.tableLabel ?? "Dine-in"
    : `Takeaway #${order.orderNumber}`;

const itemCount = (order: OrderDTO): number =>
  order.lines.filter((l) => l.state !== "VOID").reduce((s, l) => s + l.quantity, 0);

export function WaiterHome({
  username,
  restaurantName,
  staffName,
  openOrders,
}: {
  readonly username: string;
  readonly restaurantName: string;
  readonly staffName: string;
  readonly openOrders: readonly OrderDTO[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{restaurantName}</p>
          <h1 className="text-xl font-bold">Hi, {staffName}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => staffLogoutAction(username))}
        >
          <LogOutIcon className="size-4" />
          Log out
        </Button>
      </div>

      <Button size="lg" className="h-14 w-full text-base" render={<Link href={`/u/${username}/order/new`} />}>
        <PlusIcon className="size-5" />
        New order
      </Button>

      <div className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">
          Open orders {openOrders.length > 0 ? `(${openOrders.length})` : ""}
        </h2>
        {openOrders.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            No open orders. Tap “New order” to start one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {openOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/u/${username}/order/${order.id}`}
                  className="hover:bg-accent flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {orderTitle(order)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {itemCount(order)} items · {minutesAgo(order.createdAt)}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    ₹{orderRunningTotal(order).toFixed(0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
