"use client";

import { useState } from "react";

import { toast } from "sonner";

import { createTableAction, updateTableAction } from "@/actions/table.actions";
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
import { Switch } from "@/components/ui/switch";
import { useServerAction } from "@/hooks/use-server-action";
import type { TableDTO } from "@/types/table";

export function TableDialog({
  table,
  onOpenChange,
  onSaved,
}: {
  readonly table: TableDTO | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const [label, setLabel] = useState(table?.label ?? "");
  const [seats, setSeats] = useState(table?.seats != null ? String(table.seats) : "");
  const [section, setSection] = useState(table?.section ?? "");
  const [isActive, setIsActive] = useState(table?.isActive ?? true);

  const save = useServerAction(table ? updateTableAction : createTableAction, {
    onSuccess: () => {
      toast.success(table ? "Table updated" : "Table added");
      onOpenChange(false);
      onSaved();
    },
    onError: (message) => toast.error(message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      label,
      seats: seats ? Number(seats) : undefined,
      section: section.trim() || undefined,
      isActive,
    };
    save.execute(table ? { ...payload, id: table.id } : payload);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{table ? "Edit table" : "New table"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="t-label">Label</FieldLabel>
              <Input
                id="t-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="T1"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="t-seats">Seats</FieldLabel>
              <Input
                id="t-seats"
                inputMode="numeric"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="4"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="t-section">Section</FieldLabel>
            <Input
              id="t-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Rooftop, AC hall…"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Switch id="t-active" checked={isActive} onCheckedChange={setIsActive} />
            <label htmlFor="t-active" className="text-sm">
              Available for seating
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending || !label.trim()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
