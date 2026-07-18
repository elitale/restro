"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { countStockAction } from "@/actions/inventory.actions";
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
import { UNIT_LABELS } from "@/lib/inventory";
import type { StockItemDTO } from "@/types/inventory";

export function CountDialog({
  items,
  onOpenChange,
  onDone,
}: {
  readonly items: readonly StockItemDTO[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [countById, setCountById] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, String(i.onHand)])),
  );

  const visible = useMemo(
    () =>
      items.filter((i) =>
        i.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [items, search],
  );

  const rows = items
    .map((i) => ({ stockItemId: i.id, counted: Number(countById[i.id]), current: i.onHand }))
    .filter((r) => Number.isFinite(r.counted) && r.counted >= 0 && r.counted !== r.current)
    .map((r) => ({ stockItemId: r.stockItemId, countedOnHand: r.counted }));

  const save = useServerAction(countStockAction, {
    onSuccess: () => {
      toast.success(`Updated ${rows.length} count${rows.length === 1 ? "" : "s"}`);
      onOpenChange(false);
      onDone();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Physical count</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">
          Enter what&apos;s actually on the shelf. Only changed rows are saved as
          corrections.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
        />
        <div className="min-h-0 flex-1 divide-y overflow-y-auto rounded-md border">
          {visible.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">
                  System {item.onHand} {UNIT_LABELS[item.unit]}
                </p>
              </div>
              <Input
                className="w-24"
                inputMode="decimal"
                value={countById[item.id] ?? ""}
                onChange={(e) =>
                  setCountById((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
            </div>
          ))}
          {visible.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">No items.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={rows.length === 0 || save.isPending}
            onClick={() => save.execute({ rows })}
          >
            {save.isPending ? "Saving…" : `Save ${rows.length} change(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
