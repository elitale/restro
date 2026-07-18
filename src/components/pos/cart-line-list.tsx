"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

import { linePrice, type CartLine } from "./types";

export function CartLineList({
  cart,
  onChangeQty,
  onToggleComp,
  onRemove,
}: {
  readonly cart: readonly CartLine[];
  readonly onChangeQty: (key: string, delta: number) => void;
  readonly onToggleComp: (key: string) => void;
  readonly onRemove: (key: string) => void;
}) {
  if (cart.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Tap items to start an order.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cart.map((line) => (
        <li key={line.key} className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {line.name}
                {line.variantName ? (
                  <span className="text-muted-foreground"> · {line.variantName}</span>
                ) : null}
              </p>
              {line.modifiers.length > 0 ? (
                <p className="text-muted-foreground truncate text-xs">
                  {line.modifiers.map((m) => m.name).join(", ")}
                </p>
              ) : null}
              {line.lineNote ? (
                <p className="text-muted-foreground truncate text-xs italic">
                  {line.lineNote}
                </p>
              ) : null}
            </div>
            <span className="text-sm tabular-nums">
              {line.isComp ? (
                <Badge variant="secondary" className="text-[10px]">
                  Comp
                </Badge>
              ) : (
                formatCurrency(linePrice(line))
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => onChangeQty(line.key, -1)}
            >
              −
            </Button>
            <span className="w-5 text-center text-sm tabular-nums">
              {line.quantity}
            </span>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => onChangeQty(line.key, 1)}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 px-2 text-xs"
              onClick={() => onToggleComp(line.key)}
            >
              {line.isComp ? "Uncomp" : "Comp"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive h-7 px-2 text-xs"
              onClick={() => onRemove(line.key)}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
