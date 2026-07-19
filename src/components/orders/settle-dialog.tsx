"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { settleOrderAction } from "@/actions/order.actions";
import {
  PaymentEntryFields,
  usePaymentEntry,
} from "@/components/pos/payment-entry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import { computeBill, type BillLineInput, type DiscountKind } from "@/services/billing";
import type { OrderDTO } from "@/types/order";

const DISCOUNTS: readonly { value: DiscountKind; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "PERCENT", label: "%" },
  { value: "FLAT", label: "₹ off" },
];

export function SettleDialog({
  order,
  onOpenChange,
  onSettled,
}: {
  readonly order: OrderDTO;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSettled: (orderId: string) => void;
}) {
  const [discountType, setDiscountType] = useState<DiscountKind>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  const billLines = useMemo<BillLineInput[]>(
    () =>
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
    [order.lines],
  );

  const discountNum = Number(discountValue) || 0;
  const bill = useMemo(
    () => computeBill(billLines, { type: discountType, value: discountNum }),
    [billLines, discountType, discountNum],
  );

  const pay = usePaymentEntry(bill.grandTotal);

  const settle = useServerAction(settleOrderAction, {
    onSuccess: () => {
      toast.success("Order settled");
      onOpenChange(false);
      onSettled(order.id);
    },
    onError: (message) => toast.error(message),
  });

  const discountOk = discountType === "NONE" || discountNum > 0;
  const canSettle = pay.covered && discountOk && !settle.isPending;

  const submit = () => {
    if (!canSettle) {
      return;
    }
    settle.execute({
      orderId: order.id,
      discountType,
      discountValue: discountNum,
      discountReason: discountReason.trim() || undefined,
      payments: pay.toPayments(),
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settle order #{order.orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Discount */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Discount</span>
            <div className="flex gap-2">
              {DISCOUNTS.map((d) => (
                <Button
                  key={d.value}
                  size="sm"
                  variant={d.value === discountType ? "default" : "outline"}
                  onClick={() => setDiscountType(d.value)}
                >
                  {d.label}
                </Button>
              ))}
              {discountType !== "NONE" ? (
                <Input
                  className="w-24"
                  inputMode="decimal"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "PERCENT" ? "10" : "50"}
                />
              ) : null}
            </div>
            {discountType !== "NONE" ? (
              <Input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Discount reason (optional)"
              />
            ) : null}
          </div>

          {/* Bill */}
          <dl className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(bill.subtotal)}</dd>
            </div>
            {bill.discountTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular-nums">−{formatCurrency(bill.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST</dt>
              <dd className="tabular-nums">{formatCurrency(bill.taxTotal)}</dd>
            </div>
            {bill.roundOff !== 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Round off</dt>
                <dd className="tabular-nums">{formatCurrency(bill.roundOff)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatCurrency(bill.grandTotal)}</dd>
            </div>
          </dl>

          <PaymentEntryFields entry={pay} />
        </div>

        <DialogFooter>
          <Button disabled={!canSettle} onClick={submit}>
            {settle.isPending
              ? "Settling…"
              : `Settle · ${formatCurrency(bill.grandTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
