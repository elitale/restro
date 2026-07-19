"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { advanceTicketAction } from "@/actions/kitchen.actions";
import { staffLogoutAction } from "@/actions/staff-auth.actions";
import { SoundToggle } from "@/components/shared/sound-toggle";
import { Button } from "@/components/ui/button";
import { useAnnouncer } from "@/hooks/use-announcer";
import { useServerAction } from "@/hooks/use-server-action";
import { newIds, newOrderPhrase } from "@/lib/announce";
import { KITCHEN_STATUS_LABEL, type KitchenStatus } from "@/lib/kitchen";
import type { KitchenTicketDTO } from "@/types/kitchen";

const STATUS_STYLE: Record<KitchenStatus, string> = {
  WAITING: "bg-amber-100 text-amber-900 ring-amber-200",
  PREPARING: "bg-sky-100 text-sky-900 ring-sky-200",
  READY: "bg-emerald-100 text-emerald-900 ring-emerald-200",
};

const AUTH_ERRORS: Record<string, string> = {
  STAFF_FORBIDDEN: "You don't have permission to do that.",
  NO_STAFF_SESSION: "Session expired. Please sign in again.",
};
const toMessage = (m: string): string => AUTH_ERRORS[m] ?? m;

const ticketTitle = (t: KitchenTicketDTO): string => {
  if (t.orderType === "DINE_IN") {
    return t.tableLabel ?? "Dine-in";
  }
  if (t.orderType === "DELIVERY") {
    return `Delivery #${t.orderNumber}`;
  }
  return `Takeaway #${t.orderNumber}`;
};

const elapsedLabel = (iso: string | null, now: number): string => {
  if (!iso) {
    return "";
  }
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  return `${mins} min`;
};

function TicketCard({
  ticket,
  now,
}: {
  readonly ticket: KitchenTicketDTO;
  readonly now: number;
}) {
  const advance = useServerAction(advanceTicketAction, {
    refresh: true,
    onError: (m) => toast.error(toMessage(m)),
  });

  return (
    <li className="bg-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{ticketTitle(ticket)}</p>
          {ticket.firstFiredAt ? (
            <p className="text-muted-foreground text-sm">
              {elapsedLabel(ticket.firstFiredAt, now)}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${STATUS_STYLE[ticket.status]}`}
        >
          {KITCHEN_STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {ticket.batches.map((batch, idx) => (
          <div key={batch.firedAt ?? idx} className="flex flex-col gap-2">
            {batch.isAddOn ? (
              <p className="text-xs font-bold tracking-wide text-amber-700 uppercase">
                ＋ Added {elapsedLabel(batch.firedAt, now)}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {batch.lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <span className="min-w-8 text-lg font-bold tabular-nums">
                    {line.quantity}×
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {line.name}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                    </span>
                    {line.modifiers.length > 0 ? (
                      <span className="text-foreground/80 block text-sm font-semibold">
                        {line.modifiers.join(", ")}
                      </span>
                    ) : null}
                    {line.lineNote ? (
                      <span className="block text-sm font-semibold text-amber-700 italic">
                        “{line.lineNote}”
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-4 pt-0">
        {ticket.advanceLabel ? (
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={advance.isPending}
            onClick={() => advance.execute({ orderId: ticket.orderId })}
          >
            {ticket.advanceLabel}
          </Button>
        ) : (
          <p className="rounded-xl bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-800">
            Ready for pickup
          </p>
        )}
      </div>
    </li>
  );
}

export function KitchenDisplay({
  username,
  restaurantName,
  staffName,
  tickets,
}: {
  readonly username: string;
  readonly restaurantName: string;
  readonly staffName: string;
  readonly tickets: readonly KitchenTicketDTO[];
}) {
  const router = useRouter();
  const { supported, enabled, toggle, announce } = useAnnouncer();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const seenRef = useRef<ReadonlySet<string> | null>(null);

  // Live timers + lightweight polling so new/updated tickets appear hands-free.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 10000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [router]);

  // Announce freshly-arrived tickets in Hindi ("Naya order, T1").
  useEffect(() => {
    const ids = tickets.map((t) => t.orderId);
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const fresh = newIds(seenRef.current, ids);
    seenRef.current = new Set(ids);
    const ticket =
      fresh.length > 0
        ? tickets.find((t) => t.orderId === fresh[0])
        : undefined;
    if (ticket) {
      announce(newOrderPhrase(ticket), "beep");
    }
  }, [tickets, announce]);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{restaurantName}</p>
          <h1 className="text-xl font-bold">Kitchen · {staffName}</h1>
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

      <h2 className="text-muted-foreground text-sm font-medium">
        Tickets {tickets.length > 0 ? `(${tickets.length})` : ""}
      </h2>

      {tickets.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No tickets right now. New orders appear here automatically.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((t) => (
            <TicketCard key={t.orderId} ticket={t} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
