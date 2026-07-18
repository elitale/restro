"use client";

import { useState } from "react";

import { toast } from "sonner";

import {
  createStockItemAction,
  updateStockItemAction,
} from "@/actions/inventory.actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";
import { STOCK_UNIT_OPTIONS } from "@/lib/inventory";
import type { StockItemDTO, StockUnit } from "@/types/inventory";

const numberOrUndefined = (value: string) =>
  value.trim() ? Number(value) : undefined;

export function StockItemDialog({
  item,
  onOpenChange,
  onSaved,
}: {
  readonly item: StockItemDTO | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? "KG");
  const [category, setCategory] = useState(item?.category ?? "");
  const [openingOnHand, setOpeningOnHand] = useState("");
  const [reorderLevel, setReorderLevel] = useState(
    item?.reorderLevel != null ? String(item.reorderLevel) : "",
  );
  const [parLevel, setParLevel] = useState(
    item?.parLevel != null ? String(item.parLevel) : "",
  );
  const [costPerUnit, setCostPerUnit] = useState(
    item?.costPerUnit != null ? String(item.costPerUnit) : "",
  );
  const [supplier, setSupplier] = useState(item?.supplier ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const save = useServerAction(item ? updateStockItemAction : createStockItemAction, {
    onSuccess: () => {
      toast.success(item ? "Item updated" : "Item added");
      onOpenChange(false);
      onSaved();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const base = {
      name,
      unit,
      category: category.trim() || undefined,
      reorderLevel: numberOrUndefined(reorderLevel),
      parLevel: numberOrUndefined(parLevel),
      costPerUnit: numberOrUndefined(costPerUnit),
      supplier: supplier.trim() || undefined,
      notes: notes.trim() || undefined,
      isActive,
    };
    save.execute(
      item
        ? { ...base, id: item.id }
        : { ...base, openingOnHand: numberOrUndefined(openingOnHand) ?? 0 },
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New stock item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2">
              <FieldLabel htmlFor="s-name">Name</FieldLabel>
              <Input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Paneer"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-unit">Unit</FieldLabel>
              <Select value={unit} onValueChange={(v) => v && setUnit(v as StockUnit)}>
                <SelectTrigger id="s-unit">
                  <span>
                    {STOCK_UNIT_OPTIONS.find((o) => o.value === unit)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STOCK_UNIT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="s-cat">Category</FieldLabel>
              <Input
                id="s-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Dairy, Packaging…"
              />
            </Field>
          </div>

          {item ? null : (
            <Field>
              <FieldLabel htmlFor="s-opening">Opening stock on hand</FieldLabel>
              <Input
                id="s-opening"
                inputMode="decimal"
                value={openingOnHand}
                onChange={(e) => setOpeningOnHand(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="s-reorder">Reorder at</FieldLabel>
              <Input
                id="s-reorder"
                inputMode="decimal"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="2"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-par">Par level</FieldLabel>
              <Input
                id="s-par"
                inputMode="decimal"
                value={parLevel}
                onChange={(e) => setParLevel(e.target.value)}
                placeholder="10"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-cost">Cost / unit</FieldLabel>
              <Input
                id="s-cost"
                inputMode="decimal"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder="₹"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="s-supplier">Supplier</FieldLabel>
            <Input
              id="s-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-notes">Notes</FieldLabel>
            <Textarea
              id="s-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Switch id="s-active" checked={isActive} onCheckedChange={setIsActive} />
            <label htmlFor="s-active" className="text-sm">
              Active
            </label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
