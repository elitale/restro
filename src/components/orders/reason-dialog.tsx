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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function ReasonDialog({
  title,
  confirmLabel,
  pending,
  onConfirm,
  onOpenChange,
}: {
  readonly title: string;
  readonly confirmLabel: string;
  readonly pending: boolean;
  readonly onConfirm: (reason: string) => void;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reason">Reason</FieldLabel>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why?"
            rows={2}
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason.trim() || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
