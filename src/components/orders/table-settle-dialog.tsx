"use client";

import { useMemo } from "react";

import { toast } from "sonner";

import { settleTableAction } from "@/actions/order.actions";
import {
  PaymentEntryFields,
  usePaymentEntry,
} from "@/components/pos/payment-entry";
import { orderRunningTotal } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import type { OrderDTO } from "@/types/order";

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/** Settle every open order on one table with a single combined payment. */
export function TableSettleDialog({
  tableLabel,
  orders,
  onOpenChange,
  onSettled,
}: {
  readonly tableLabel: string;
  readonly orders: readonly OrderDTO[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSettled: () => void;
}) {
  const rows = useMemo(
    () => orders.map((order) => ({ order, total: orderRunningTotal(order) })),
    [orders],
  );
  const combined = round2(rows.reduce((s, r) => s + r.total, 0));

  const pay = usePaymentEntry(combined);

  const settle = useServerAction(settleTableAction, {
    refresh: true,
    onSuccess: () => {
      toast.success(`Settled ${orders.length} orders on ${tableLabel}`);
      onOpenChange(false);
      onSettled();
    },
    onError: (message) => toast.error(message),
  });

  const canSettle = pay.covered && !settle.isPending;

  const submit = () => {
    if (!canSettle) {
      return;
    }
    settle.execute({
      orderIds: orders.map((o) => o.id),
      payments: pay.toPayments(),
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settle table {tableLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <dl className="bg-muted/50 flex flex-col gap-1 rounded-md p-3 text-sm">
            {rows.map(({ order, total }) => (
              <div key={order.id} className="flex justify-between">
                <dt className="text-muted-foreground">
                  #{order.orderNumber}
                  {order.customerName ? ` · ${order.customerName}` : ""}
                </dt>
                <dd className="tabular-nums">{formatCurrency(total)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-1 text-base font-semibold">
              <dt>Combined total</dt>
              <dd className="tabular-nums">{formatCurrency(combined)}</dd>
            </div>
          </dl>

          <PaymentEntryFields entry={pay} />
        </div>

        <DialogFooter>
          <Button disabled={!canSettle} onClick={submit}>
            {settle.isPending
              ? "Settling…"
              : `Settle · ${formatCurrency(combined)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
