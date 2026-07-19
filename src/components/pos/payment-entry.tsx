"use client";

import { useState } from "react";

import { newLineKey } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import type { PaymentInput } from "@/lib/validators/order";
import type { PaymentMode } from "@/types/order";

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

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

export interface PaymentEntry {
  readonly rows: readonly PaymentRow[];
  readonly paid: number;
  readonly remaining: number;
  readonly change: number;
  readonly covered: boolean;
  readonly updateRow: (key: string, patch: Partial<PaymentRow>) => void;
  readonly addRow: () => void;
  readonly removeRow: (key: string) => void;
  readonly fillExact: (key: string) => void;
  readonly toPayments: () => PaymentInput[];
}

/**
 * Split-payment entry state + derived totals, shared by the single-order and
 * whole-table settle dialogs. Pass the bill's grand total to settle against.
 */
export function usePaymentEntry(grandTotal: number): PaymentEntry {
  const [rows, setRows] = useState<PaymentRow[]>([newRow()]);

  const paid = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const remaining = round2(grandTotal - paid);
  const change = round2(
    rows.reduce((s, r) => {
      if (r.mode !== "CASH" || !r.tendered) {
        return s;
      }
      return s + Math.max(0, (Number(r.tendered) || 0) - (Number(r.amount) || 0));
    }, 0),
  );
  const covered = paid + 0.5 >= grandTotal;

  const updateRow = (key: string, patch: Partial<PaymentRow>): void =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = (): void => setRows((prev) => [...prev, newRow("UPI")]);
  const removeRow = (key: string): void =>
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.key !== key) : prev,
    );
  const fillExact = (key: string): void => {
    const current = Number(rows.find((r) => r.key === key)?.amount) || 0;
    updateRow(key, { amount: String(round2(Math.max(0, remaining) + current)) });
  };

  const toPayments = (): PaymentInput[] => {
    const list = rows
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r) => ({
        mode: r.mode,
        amount: Number(r.amount),
        tendered:
          r.mode === "CASH" && r.tendered ? Number(r.tendered) : undefined,
        reference: r.reference.trim() || undefined,
      }));
    return list.length > 0 ? list : [{ mode: "CASH", amount: 0 }];
  };

  return {
    rows,
    paid,
    remaining,
    change,
    covered,
    updateRow,
    addRow,
    removeRow,
    fillExact,
    toPayments,
  };
}

/** Payment rows (mode + amount + tender/reference) plus a paid/remaining/change
 *  summary. Drive it with {@link usePaymentEntry}. */
export function PaymentEntryFields({
  entry,
}: {
  readonly entry: PaymentEntry;
}) {
  const { rows, paid, remaining, change, updateRow, addRow, removeRow, fillExact } =
    entry;
  return (
    <>
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
                onChange={(e) => updateRow(row.key, { tendered: e.target.value })}
                placeholder="Cash tendered (for change)"
              />
            ) : (
              <Input
                value={row.reference}
                onChange={(e) => updateRow(row.key, { reference: e.target.value })}
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
    </>
  );
}
