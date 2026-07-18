"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { removePinAction } from "@/actions/pin.actions";
import { PinDialog } from "@/components/settings/pin-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { PinStatus } from "@/services/pin-auth.service";

export function SignInPinCard({ status }: { readonly status: PinStatus }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    const result = await removePinAction();
    setRemoving(false);
    if (result.success) {
      toast.success("PIN removed");
      setRemoveOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in PIN</CardTitle>
        <CardDescription>
          Sign in with your phone number and a PIN, skipping the SMS code. Keep
          it secret — anyone with your phone number and PIN can sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {status.hasPin ? (
          <p className="text-muted-foreground text-sm">
            PIN enabled
            {status.pinUpdatedAt
              ? ` · updated ${formatDateTime(status.pinUpdatedAt)}`
              : ""}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            No PIN set. You currently sign in with a one-time SMS code.
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            {status.hasPin ? "Change PIN" : "Set a PIN"}
          </Button>
          {status.hasPin ? (
            <Button variant="outline" onClick={() => setRemoveOpen(true)}>
              Remove
            </Button>
          ) : null}
        </div>
      </CardContent>

      {dialogOpen ? (
        <PinDialog
          mode={status.hasPin ? "change" : "set"}
          onOpenChange={setDialogOpen}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {removeOpen ? (
        <Dialog open onOpenChange={(open) => !open && setRemoveOpen(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove your sign-in PIN?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              You&apos;ll sign in with a one-time SMS code until you set a new
              PIN.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={removing} onClick={remove}>
                {removing ? "Removing…" : "Remove PIN"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
