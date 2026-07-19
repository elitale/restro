"use client";

import { useTransition } from "react";

import { LogOutIcon } from "lucide-react";

import { staffLogoutAction } from "@/actions/staff-auth.actions";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<string, string> = {
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
};

export function StaffHome({
  username,
  name,
  role,
  restaurantName,
}: {
  readonly username: string;
  readonly name: string;
  readonly role: string;
  readonly restaurantName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{restaurantName}</p>
          <h1 className="text-xl font-bold">Hi, {name}</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {ROLE_LABEL[role] ?? role}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => staffLogoutAction(username))}
        >
          <LogOutIcon className="size-4" />
          Log out
        </Button>
      </div>

      <div className="border-border/60 rounded-lg border border-dashed p-6 text-center">
        <p className="font-medium">
          {role === "KITCHEN" ? "Kitchen display" : "Order taking"} is coming
          next.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          You&apos;re signed in. Your work screen will appear here.
        </p>
      </div>
    </div>
  );
}
