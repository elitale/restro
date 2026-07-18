"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { settleOrderAction } from "@/actions/order.actions";
import { newLineKey } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import { computeBill, type BillLineInput, type DiscountKind } from "@/services/billing";
import type { OrderDTO, PaymentMode } from "@/types/order";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const DISCOUNTS: readonly { value: DiscountKind; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "PERCENT", label: "%" },
  { value: "FLAT", label: "₹ off" },
];

const MODES: readonly { value: PaymentMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

interface PaymentRow {
  readonly key: string;
  readonly mode: PaymentMode;
  readonly amount: string;
  readonly tendered: string;
  readonly reference: string;
}

const newRow = (mode: PaymentMode = "CASH"): PaymentRow => ({
  key: newLineKey(),
  mode,
  amount: "",
  tendered: "",
  reference: "",
});

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
  const [rows, setRows] = useState<PaymentRow[]>([newRow()]);

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

  const paid = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const remaining = round2(bill.grandTotal - paid);
  const change = round2(
    rows.reduce((s, r) => {
      if (r.mode !== "CASH" || !r.tendered) {
        return s;
      }
      return s + Math.max(0, (Number(r.tendered) || 0) - (Number(r.amount) || 0));
    }, 0),
  );

  const updateRow = (key: string, patch: Partial<PaymentRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, newRow("UPI")]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  const fillExact = (key: string) =>
    updateRow(key, {
      amount: String(round2(Math.max(0, remaining) + (Number(rowAmount(key)) || 0))),
    });
  const rowAmount = (key: string) =>
    rows.find((r) => r.key === key)?.amount ?? "";

  const settle = useServerAction(settleOrderAction, {
    onSuccess: () => {
      toast.success("Order settled");
      onOpenChange(false);
      onSettled(order.id);
    },
    onError: (message) => toast.error(message),
  });

  const covered = paid + 0.5 >= bill.grandTotal;
  const discountOk = discountType === "NONE" || discountNum > 0;
  const canSettle = covered && discountOk && !settle.isPending;

  const submit = () => {
    if (!canSettle) {
      return;
    }
    const payments = rows
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r) => ({
        mode: r.mode,
        amount: Number(r.amount),
        tendered:
          r.mode === "CASH" && r.tendered ? Number(r.tendered) : undefined,
        reference: r.reference.trim() || undefined,
      }));
    settle.execute({
      orderId: order.id,
      discountType,
      discountValue: discountNum,
      discountReason: discountReason.trim() || undefined,
      payments: payments.length > 0 ? payments : [{ mode: "CASH", amount: 0 }],
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

          {/* Payments */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Payments</span>
              <Button size="sm" variant="ghost" onClick={addRow}>
                + Split
              </Button>
            </div>
            {rows.map((row) => (
              <div key={row.key} className="flex flex-col gap-2 rounded-md border p-2">
                <div className="flex gap-2">
                  <Select
                    value={row.mode}
                    onValueChange={(v) =>
                      v && updateRow(row.key, { mode: v as PaymentMode })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <span>{MODES.find((m) => m.value === row.mode)?.label}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                    placeholder="Amount"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fillExact(row.key)}
                  >
                    Exact
                  </Button>
                  {rows.length > 1 ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeRow(row.key)}
                    >
                      ×
                    </Button>
                  ) : null}
                </div>
                {row.mode === "CASH" ? (
                  <Input
                    inputMode="decimal"
                    value={row.tendered}
                    onChange={(e) =>
                      updateRow(row.key, { tendered: e.target.value })
                    }
                    placeholder="Cash tendered (for change)"
                  />
                ) : (
                  <Input
                    value={row.reference}
                    onChange={(e) =>
                      updateRow(row.key, { reference: e.target.value })
                    }
                    placeholder="Reference (optional)"
                  />
                )}
              </div>
            ))}
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="tabular-nums">{formatCurrency(paid)}</dd>
            </div>
            {remaining > 0.5 ? (
              <div className="text-destructive flex justify-between font-medium">
                <dt>Remaining</dt>
                <dd className="tabular-nums">{formatCurrency(remaining)}</dd>
              </div>
            ) : change > 0 ? (
              <div className="flex justify-between font-medium">
                <dt>Change due</dt>
                <dd className="tabular-nums">{formatCurrency(change)}</dd>
              </div>
            ) : null}
          </dl>
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
