"use client";

import { useState } from "react";

import { toast } from "sonner";

import { setSelfOrderEnabledAction } from "@/actions/settings.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useServerAction } from "@/hooks/use-server-action";

export function SelfOrderCard({
  enabled,
  username,
}: {
  readonly enabled: boolean;
  readonly username: string;
}) {
  const [checked, setChecked] = useState(enabled);

  const save = useServerAction(setSelfOrderEnabledAction, {
    refresh: true,
    onSuccess: () => toast.success("Self-ordering updated"),
    onError: (message) => {
      setChecked((prev) => !prev);
      toast.error(message);
    },
  });

  const onToggle = (next: boolean) => {
    setChecked(next);
    save.execute({ enabled: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest self-ordering</CardTitle>
        <CardDescription>
          Let seated guests scan a QR code and order from their phone. Orders go
          straight to the kitchen and attach to the table&apos;s bill.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="self-order" className="text-sm font-medium">
            {checked ? "Enabled" : "Disabled"}
          </label>
          <Switch
            id="self-order"
            checked={checked}
            disabled={save.isPending}
            onCheckedChange={onToggle}
          />
        </div>
        <FieldDescription>
          Each table&apos;s QR links to{" "}
          <span className="font-mono">/order/{username}?table=…</span>. Guests
          verify their phone with a one-time code before their first order.
        </FieldDescription>
      </CardContent>
    </Card>
  );
}
