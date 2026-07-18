"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  fireOrderAction,
  serveLineAction,
  voidLineAction,
  voidOrderAction,
} from "@/actions/order.actions";
import { AddItemsDialog } from "@/components/orders/add-items-dialog";
import { ReasonDialog } from "@/components/orders/reason-dialog";
import { SettleDialog } from "@/components/orders/settle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeBill } from "@/services/billing";
import type { MenuDTO } from "@/types/menu";
import type { OrderDTO, OrderLineDTO, OrderLineState } from "@/types/order";

const STATE_BADGE: Record<
  OrderLineState,
  { label: string; className: string }
> = {
  UNSENT: { label: "Unsent", className: "bg-muted text-muted-foreground" },
  FIRED: { label: "Fired", className: "bg-amber-100 text-amber-800" },
  SERVED: { label: "Served", className: "bg-green-100 text-green-800" },
  VOID: { label: "Void", className: "bg-red-100 text-red-800" },
};

const lineTotal = (line: OrderLineDTO): number =>
  line.isComp
    ? 0
    : (line.unitPrice + line.modifiers.reduce((s, m) => s + m.priceDelta, 0)) *
      line.quantity;

export function OrderDetail({
  order,
  menu,
}: {
  readonly order: OrderDTO;
  readonly menu: MenuDTO;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [voidOrderOpen, setVoidOrderOpen] = useState(false);
  const [voidLineTarget, setVoidLineTarget] = useState<OrderLineDTO | null>(null);

  const isOpen = order.status === "OPEN";
  const hasUnsent = order.lines.some((l) => l.state === "UNSENT");

  const preview = useMemo(
    () =>
      computeBill(
        order.lines
          .filter((l) => l.state !== "VOID")
          .map((l) => ({
            unitPrice: l.unitPrice,
            modifiersDelta: l.modifiers.reduce((s, m) => s + m.priceDelta, 0),
            quantity: l.quantity,
            taxRate: l.taxRate,
            taxInclusive: l.taxInclusive,
            isComp: l.isComp,
          })),
      ),
    [order.lines],
  );

  const fire = useServerAction(fireOrderAction, {
    refresh: true,
    onSuccess: () => toast.success("Sent to kitchen"),
    onError: (m) => toast.error(m),
  });
  const serve = useServerAction(serveLineAction, {
    refresh: true,
    onError: (m) => toast.error(m),
  });
  const voidLine = useServerAction(voidLineAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Line voided");
      setVoidLineTarget(null);
    },
    onError: (m) => toast.error(m),
  });
  const voidOrder = useServerAction(voidOrderAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Order voided");
      setVoidOrderOpen(false);
    },
    onError: (m) => toast.error(m),
  });

  const openTab = (path: string) => window.open(path, "_blank");

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Order #{order.orderNumber}
            {order.invoiceNumber ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                · Invoice {order.invoiceNumber}
              </span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm">
            {order.orderType.replace("_", "-")}
            {order.tableLabel ? ` · Table ${order.tableLabel}` : ""}
            {order.customerName ? ` · ${order.customerName}` : ""}
            {" · "}
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge
          variant={order.status === "OPEN" ? "default" : "secondary"}
          className={cn(order.status === "VOID" && "bg-red-100 text-red-800")}
        >
          {order.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {isOpen ? (
          <>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              Add items
            </Button>
            {hasUnsent ? (
              <Button
                variant="outline"
                disabled={fire.isPending}
                onClick={() => fire.execute({ orderId: order.id })}
              >
                Fire
              </Button>
            ) : null}
            <Button onClick={() => setSettleOpen(true)}>Settle</Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setVoidOrderOpen(true)}
            >
              Void order
            </Button>
          </>
        ) : null}
        <Button
          variant="outline"
          onClick={() => openTab(`/dashboard/orders/${order.id}/kot`)}
        >
          Print KOT
        </Button>
        {order.status === "COMPLETED" ? (
          <Button
            variant="outline"
            onClick={() => openTab(`/dashboard/orders/${order.id}/invoice`)}
          >
            Print invoice
          </Button>
        ) : null}
      </div>

      {/* Lines */}
      <ul className="divide-y rounded-lg border">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  line.state === "VOID" && "text-muted-foreground line-through",
                )}
              >
                {line.quantity}× {line.name}
                {line.variantName ? (
                  <span className="text-muted-foreground"> · {line.variantName}</span>
                ) : null}
              </p>
              {line.modifiers.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {line.modifiers.map((m) => m.name).join(", ")}
                </p>
              ) : null}
              {line.lineNote ? (
                <p className="text-muted-foreground text-xs italic">{line.lineNote}</p>
              ) : null}
              <span
                className={cn(
                  "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                  STATE_BADGE[line.state].className,
                )}
              >
                {STATE_BADGE[line.state].label}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm tabular-nums">
                {line.isComp ? "Comp" : formatCurrency(lineTotal(line))}
              </span>
              {isOpen && line.state !== "VOID" ? (
                <div className="flex gap-1 print:hidden">
                  {line.state === "FIRED" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={serve.isPending}
                      onClick={() =>
                        serve.execute({ orderId: order.id, itemId: line.id })
                      }
                    >
                      Serve
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 px-2 text-xs"
                    onClick={() => setVoidLineTarget(line)}
                  >
                    Void
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        {order.status === "COMPLETED" ? (
          <>
            <Row label="Subtotal" value={order.subtotal} />
            {order.discountTotal > 0 ? (
              <Row label="Discount" value={-order.discountTotal} />
            ) : null}
            <Row label="GST" value={order.taxTotal} />
            {order.roundOff !== 0 ? (
              <Row label="Round off" value={order.roundOff} />
            ) : null}
            <Row label="Grand total" value={order.grandTotal} strong />
            {order.payments.map((p) => (
              <div key={p.id} className="text-muted-foreground flex justify-between">
                <dt>{p.mode}</dt>
                <dd className="tabular-nums">{formatCurrency(p.amount)}</dd>
              </div>
            ))}
          </>
        ) : (
          <>
            <Row label="Subtotal" value={preview.subtotal} />
            <Row label="GST" value={preview.taxTotal} />
            <Row label="Total (est.)" value={preview.grandTotal} strong />
          </>
        )}
      </dl>

      {addOpen ? (
        <AddItemsDialog
          orderId={order.id}
          menu={menu}
          onOpenChange={setAddOpen}
          onAdded={() => router.refresh()}
        />
      ) : null}
      {settleOpen ? (
        <SettleDialog
          order={order}
          onOpenChange={setSettleOpen}
          onSettled={() => router.refresh()}
        />
      ) : null}
      {voidOrderOpen ? (
        <ReasonDialog
          title={`Void order #${order.orderNumber}?`}
          confirmLabel="Void order"
          pending={voidOrder.isPending}
          onConfirm={(reason) => voidOrder.execute({ orderId: order.id, reason })}
          onOpenChange={setVoidOrderOpen}
        />
      ) : null}
      {voidLineTarget ? (
        <ReasonDialog
          title={`Void ${voidLineTarget.name}?`}
          confirmLabel="Void line"
          pending={voidLine.isPending}
          onConfirm={(reason) =>
            voidLine.execute({
              orderId: order.id,
              itemId: voidLineTarget.id,
              reason,
            })
          }
          onOpenChange={(open) => {
            if (!open) {
              setVoidLineTarget(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  readonly label: string;
  readonly value: number;
  readonly strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between",
        strong ? "text-base font-semibold" : "text-muted-foreground",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatCurrency(value)}</dd>
    </div>
  );
}
