"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { QrCodeIcon } from "lucide-react";
import { toast } from "sonner";

import { deleteTableAction } from "@/actions/table.actions";
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
import { groupTablesBySection } from "@/lib/tables";
import type { TableDTO } from "@/types/table";

import { TableDialog } from "./table-dialog";
import { TableShareDialog } from "./table-share-dialog";

export function TablesManager({
  tables,
  username,
  selfOrderEnabled,
}: {
  readonly tables: TableDTO[];
  readonly username: string;
  readonly selfOrderEnabled: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableDTO | null>(null);
  const [shareTarget, setShareTarget] = useState<TableDTO | null>(null);

  const del = useServerAction(deleteTableAction, {
    refresh: true,
    onSuccess: () => {
      toast.success("Table removed");
      setDeleteTarget(null);
    },
    onError: (message) => toast.error(message),
  });

  const openNew = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };
  const openEdit = (table: TableDTO) => {
    setEditTarget(table);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Tables"
          description="Set up your floor so servers can seat dine-in orders."
        />
        <Button onClick={openNew}>Add table</Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add your tables and sections so the POS can attach dine-in orders to a table."
        />
      ) : (
        groupTablesBySection(tables).map(([section, rows]) => (
          <div key={section} className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">{section}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((table) => (
                <li
                  key={table.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {table.label}
                      {!table.isActive ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      ) : null}
                    </p>
                    {table.seats != null ? (
                      <p className="text-muted-foreground text-xs">
                        {table.seats} seats
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setShareTarget(table)}
                    >
                      <QrCodeIcon className="size-4" />
                      Share
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => openEdit(table)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-8 px-2 text-xs"
                      onClick={() => setDeleteTarget(table)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {dialogOpen ? (
        <TableDialog
          table={editTarget}
          onOpenChange={setDialogOpen}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {shareTarget ? (
        <TableShareDialog
          table={shareTarget}
          username={username}
          selfOrderEnabled={selfOrderEnabled}
          onOpenChange={(open) => !open && setShareTarget(null)}
        />
      ) : null}

      {deleteTarget ? (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {deleteTarget.label}?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              Past orders keep their record. You can re-add this label later.
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
