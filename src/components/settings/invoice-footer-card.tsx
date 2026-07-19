"use client";

import { useState } from "react";

import { toast } from "sonner";

import { setInvoiceFooterAction } from "@/actions/settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";

export function InvoiceFooterCard({ note }: { readonly note: string }) {
  const [value, setValue] = useState(note);

  const save = useServerAction(setInvoiceFooterAction, {
    refresh: true,
    onSuccess: () => toast.success("Invoice footer updated"),
    onError: (message) => toast.error(message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice footer note</CardTitle>
        <CardDescription>
          A custom message printed at the bottom of every bill / invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="e.g. Thank you! Visit again. We also take orders on Swiggy & Zomato."
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription>
            Up to 300 characters. Leave empty to remove.
          </FieldDescription>
          <Button
            size="sm"
            disabled={save.isPending || value.trim() === note.trim()}
            onClick={() => save.execute({ note: value.trim() })}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
