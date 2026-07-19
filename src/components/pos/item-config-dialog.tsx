"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ImageCarousel } from "@/components/shared/image-carousel";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuItemDTO, MenuModifierGroupDTO } from "@/types/menu";

import { modifiersDelta, newLineKey, type CartLine, type CartModifier } from "./types";

const initialSelection = (
  groups: readonly MenuModifierGroupDTO[],
): Record<string, string[]> => {
  const selection: Record<string, string[]> = {};
  for (const group of groups) {
    selection[group.id] = group.isRequired
      ? group.modifiers.slice(0, Math.max(group.minSelect, 1)).map((m) => m.id)
      : [];
  }
  return selection;
};

export function ItemConfigDialog({
  item,
  onAdd,
  onOpenChange,
}: {
  readonly item: MenuItemDTO;
  readonly onAdd: (line: CartLine) => void;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(
    item.variants[0]?.id ?? null,
  );
  const [selection, setSelection] = useState<Record<string, string[]>>(() =>
    initialSelection(item.modifierGroups),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = variant ? variant.price : item.price;

  const photos = [...item.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );

  const selectedModifiers: CartModifier[] = item.modifierGroups.flatMap((group) =>
    (selection[group.id] ?? []).flatMap((id) => {
      const modifier = group.modifiers.find((m) => m.id === id);
      return modifier
        ? [{ id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]
        : [];
    }),
  );

  const toggleModifier = (group: MenuModifierGroupDTO, modifierId: string) => {
    setSelection((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(modifierId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }
      if (group.maxSelect === 1) {
        return { ...prev, [group.id]: [modifierId] };
      }
      if (current.length >= group.maxSelect) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  };

  const unmetGroup = item.modifierGroups.find(
    (group) => (selection[group.id] ?? []).length < group.minSelect,
  );
  const lineTotal = (unitPrice + modifiersDelta(selectedModifiers)) * quantity;

  const add = () => {
    if (unmetGroup) {
      return;
    }
    onAdd({
      key: newLineKey(),
      menuItemId: item.id,
      name: item.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      unitPrice,
      taxRate: item.tax.rate,
      taxInclusive: item.tax.inclusive,
      modifiers: selectedModifiers,
      quantity,
      lineNote: note.trim() || null,
      isComp: false,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {photos.length > 0 ? (
            <ImageCarousel images={photos} alt={item.name} />
          ) : null}

          {item.shortDescription ? (
            <p className="text-muted-foreground text-sm">
              {item.shortDescription}
            </p>
          ) : null}

          {item.variants.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Size</span>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    size="sm"
                    variant={v.id === variantId ? "default" : "outline"}
                    onClick={() => setVariantId(v.id)}
                  >
                    {v.name} · {formatCurrency(v.price)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {item.modifierGroups.map((group) => {
            const selected = selection[group.id] ?? [];
            const atMax = selected.length >= group.maxSelect;
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{group.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {group.isRequired ? "Required" : "Optional"}
                    {group.maxSelect > 1 ? ` · up to ${group.maxSelect}` : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {group.modifiers.map((m) => {
                    const checked = selected.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm",
                          checked && "border-primary bg-primary/5",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            disabled={!checked && atMax && group.maxSelect > 1}
                            onCheckedChange={() => toggleModifier(group, m.id)}
                          />
                          {m.name}
                        </span>
                        {m.priceDelta !== 0 ? (
                          <span className="text-muted-foreground">
                            +{formatCurrency(m.priceDelta)}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Field>
            <FieldLabel htmlFor="line-note">Note</FieldLabel>
            <Textarea
              id="line-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="No onion, extra spicy…"
              rows={2}
            />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{quantity}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={add} disabled={Boolean(unmetGroup)}>
            {unmetGroup
              ? `Choose ${unmetGroup.name}`
              : `Add · ${formatCurrency(lineTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
