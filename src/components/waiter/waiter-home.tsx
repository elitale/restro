"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LogOutIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { markPickedUpAction } from "@/actions/kitchen.actions";
import { staffLogoutAction } from "@/actions/staff-auth.actions";
import { orderRunningTotal } from "@/components/pos/types";
import { KitchenStatusBadge } from "@/components/shared/kitchen-status-badge";
import { SelfOrderBadge } from "@/components/shared/self-order-badge";
import { SoundToggle } from "@/components/shared/sound-toggle";
import { Button } from "@/components/ui/button";
import { useAnnouncer } from "@/hooks/use-announcer";
import { useServerAction } from "@/hooks/use-server-action";
import { newIds, orderReadyPhrase } from "@/lib/announce";
import { deriveKitchenStatus } from "@/lib/kitchen";
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

const isReady = (order: OrderDTO): boolean =>
  deriveKitchenStatus(order.lines.map((l) => l.state)) === "READY";

const hasSelfOrder = (order: OrderDTO): boolean =>
  order.lines.some((l) => l.state !== "VOID" && l.source === "SELF_ORDER");

const AUTH_ERRORS: Record<string, string> = {
  STAFF_FORBIDDEN: "You don't have permission to do that.",
  NO_STAFF_SESSION: "Session expired. Please sign in again.",
  ORDER_NOT_OPEN: "This order is no longer open.",
};
const toMessage = (m: string) => AUTH_ERRORS[m] ?? m;

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
  const router = useRouter();
  const { supported, enabled, toggle, announce } = useAnnouncer();
  const [pending, startTransition] = useTransition();
  const readyRef = useRef<ReadonlySet<string> | null>(null);
  const pickup = useServerAction(markPickedUpAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Picked up \u2713");
      announce("Order utha liya", "boop");
    },
    onError: (m) => toast.error(toMessage(m)),
  });

  // Auto-refresh so kitchen status (Preparing / Ready) stays current hands-free.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [router]);

  // Announce when an order turns ready in Hindi ("T1 ka order taiyar hai").
  useEffect(() => {
    const ready = openOrders.filter(isReady);
    const ids = ready.map((o) => o.id);
    if (readyRef.current === null) {
      readyRef.current = new Set(ids);
      return;
    }
    const fresh = newIds(readyRef.current, ids);
    readyRef.current = new Set(ids);
    const readyOrder =
      fresh.length > 0 ? ready.find((o) => o.id === fresh[0]) : undefined;
    if (readyOrder) {
      announce(orderReadyPhrase(readyOrder), "boop");
    }
  }, [openOrders, announce]);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{restaurantName}</p>
          <h1 className="text-xl font-bold">Hi, {staffName}</h1>
        </div>
        <div className="flex items-center gap-1">
          <SoundToggle
            supported={supported}
            enabled={enabled}
            onToggle={toggle}
          />
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
              <li
                key={order.id}
                className="overflow-hidden rounded-xl border"
              >
                <Link
                  href={`/u/${username}/order/${order.id}`}
                  className="hover:bg-accent flex items-center justify-between gap-3 p-4 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">
                        {orderTitle(order)}
                      </span>
                      <KitchenStatusBadge
                        states={order.lines.map((l) => l.state)}
                      />
                      {hasSelfOrder(order) ? <SelfOrderBadge /> : null}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {itemCount(order)} items · {minutesAgo(order.createdAt)}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    ₹{orderRunningTotal(order).toFixed(0)}
                  </span>
                </Link>
                {isReady(order) ? (
                  <div className="border-t p-2">
                    <Button
                      className="h-11 w-full text-base"
                      disabled={pickup.isPending}
                      onClick={() => pickup.execute({ orderId: order.id })}
                    >
                      Pick up
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
