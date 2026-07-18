"use client";

import { useState } from "react";

import { toast } from "sonner";

import { adjustStockAction } from "@/actions/inventory.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { UNIT_LABELS, WASTE_REASONS } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { StockItemDTO } from "@/types/inventory";

export function AdjustDialog({
  item,
  type,
  onOpenChange,
  onDone,
}: {
  readonly item: StockItemDTO;
  readonly type: "RECEIVE" | "WASTE";
  readonly onOpenChange: (open: boolean) => void;
  readonly onDone: () => void;
}) {
  const isWaste = type === "WASTE";
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const save = useServerAction(adjustStockAction, {
    onSuccess: () => {
      toast.success(isWaste ? "Waste logged" : "Stock received");
      onOpenChange(false);
      onDone();
    },
    onError: (message) => toast.error(message),
  });

  const qty = Number(quantity);
  const submit = () => {
    if (!(qty > 0)) {
      return;
    }
    save.execute({
      stockItemId: item.id,
      type,
      quantity: qty,
      reason: isWaste ? reason || undefined : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isWaste ? "Log waste" : "Receive"} · {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="adj-qty">
              Quantity ({UNIT_LABELS[item.unit]})
            </FieldLabel>
            <Input
              id="adj-qty"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </Field>
          {isWaste ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Reason</span>
              <div className="flex flex-wrap gap-1.5">
                {WASTE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(reason === r ? "" : r)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      reason === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Field>
            <FieldLabel htmlFor="adj-note">Note</FieldLabel>
            <Input
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant={isWaste ? "destructive" : "default"}
            disabled={save.isPending || !(qty > 0)}
            onClick={submit}
          >
            {save.isPending ? "Saving…" : isWaste ? "Log waste" : "Receive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
