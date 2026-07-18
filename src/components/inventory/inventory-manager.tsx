"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { deleteStockItemAction } from "@/actions/inventory.actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { UNIT_LABELS } from "@/lib/inventory";
import type { StockItemDTO } from "@/types/inventory";

import { AdjustDialog } from "./adjust-dialog";
import { BulkReceiveDialog } from "./bulk-receive-dialog";
import { CountDialog } from "./count-dialog";
import { StockItemDialog } from "./stock-item-dialog";

const groupByCategory = (
  items: readonly StockItemDTO[],
): [string, StockItemDTO[]][] => {
  const groups = new Map<string, StockItemDTO[]>();
  for (const item of items) {
    const key = item.category?.trim() || "Uncategorized";
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }
  return [...groups.entries()];
};

export function InventoryManager({
  items,
}: {
  readonly items: StockItemDTO[];
}) {
  const router = useRouter();
  const activeItems = items.filter((i) => i.isActive);
  const lowCount = items.filter((i) => i.isLow).length;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItemDTO | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [adjust, setAdjust] = useState<{
    item: StockItemDTO;
    type: "RECEIVE" | "WASTE";
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItemDTO | null>(null);

  const del = useServerAction(deleteStockItemAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Item removed");
      setDeleteTarget(null);
    },
    onError: (message) => toast.error(message),
  });

  const openNew = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };
  const openEdit = (item: StockItemDTO) => {
    setEditTarget(item);
    setDialogOpen(true);
  };
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Inventory"
          description="A manual stock log — receive, waste and count to keep on-hand honest."
        />
        <div className="flex flex-wrap gap-2">
          {lowCount > 0 ? (
            <Badge variant="secondary" className="self-center">
              {lowCount} low
            </Badge>
          ) : null}
          <Button
            variant="outline"
            disabled={activeItems.length === 0}
            onClick={() => setBulkOpen(true)}
          >
            Receive
          </Button>
          <Button
            variant="outline"
            disabled={activeItems.length === 0}
            onClick={() => setCountOpen(true)}
          >
            Count
          </Button>
          <Button onClick={openNew}>Add item</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No stock items yet"
          description="Add the ingredients + supplies you want to track, then log deliveries and wastage."
        />
      ) : (
        groupByCategory(items).map(([category, rows]) => (
          <div key={category} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">{category}</h2>
            <ul className="divide-y rounded-lg border">
              {rows.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {item.name}
                      {item.isLow ? (
                        <Badge className="bg-amber-100 text-[10px] text-amber-800">
                          Low
                        </Badge>
                      ) : null}
                      {!item.isActive ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.reorderLevel != null
                        ? `Reorder at ${item.reorderLevel}`
                        : "No reorder level"}
                      {item.parLevel != null ? ` · Par ${item.parLevel}` : ""}
                      {item.costPerUnit != null ? ` · ₹${item.costPerUnit}/${UNIT_LABELS[item.unit]}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right tabular-nums">
                      <span className="text-base font-semibold">{item.onHand}</span>{" "}
                      <span className="text-muted-foreground text-sm">
                        {UNIT_LABELS[item.unit]}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => setAdjust({ item, type: "RECEIVE" })}
                      >
                        Receive
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8 px-2 text-xs"
                        onClick={() => setAdjust({ item, type: "WASTE" })}
                      >
                        Waste
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        render={<Link href={`/dashboard/inventory/${item.id}`} />}
                      >
                        History
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8 px-2 text-xs"
                        onClick={() => setDeleteTarget(item)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {dialogOpen ? (
        <StockItemDialog
          item={editTarget}
          onOpenChange={setDialogOpen}
          onSaved={refresh}
        />
      ) : null}
      {bulkOpen ? (
        <BulkReceiveDialog
          items={activeItems}
          onOpenChange={setBulkOpen}
          onDone={refresh}
        />
      ) : null}
      {countOpen ? (
        <CountDialog
          items={activeItems}
          onOpenChange={setCountOpen}
          onDone={refresh}
        />
      ) : null}
      {adjust ? (
        <AdjustDialog
          item={adjust.item}
          type={adjust.type}
          onOpenChange={(open) => !open && setAdjust(null)}
          onDone={refresh}
        />
      ) : null}
      {deleteTarget ? (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {deleteTarget.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              Its movement history is kept. You can re-add the name later.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={del.isPending}
                onClick={() => del.execute({ id: deleteTarget.id })}
              >
                {del.isPending ? "Removing…" : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
