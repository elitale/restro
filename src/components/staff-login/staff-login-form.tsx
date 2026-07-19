"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { DeleteIcon, UtensilsCrossedIcon } from "lucide-react";

import { staffLoginAction } from "@/actions/staff-auth.actions";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/hooks/use-server-action";
import type { StaffLoginOption } from "@/services/staff-auth.service";

const AUTH_ERRORS: Record<string, string> = {
  STAFF_LOGIN_INVALID: "Incorrect PIN.",
  STAFF_LOGIN_LOCKED: "Too many attempts. Wait a minute and try again.",
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ROLE_LABEL: Record<string, string> = {
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

function Avatar({
  name,
  photoUrl,
  className,
}: {
  readonly name: string;
  readonly photoUrl: string | null;
  readonly className: string;
}) {
  return (
    <span
      className={`ring-border bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ring-1 ${className}`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={64}
          height={64}
          className="size-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function StaffLoginForm({
  username,
  restaurantName,
  logoUrl,
  staff,
}: {
  readonly username: string;
  readonly restaurantName: string;
  readonly logoUrl: string | null;
  readonly staff: readonly StaffLoginOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<StaffLoginOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useServerAction(staffLoginAction, {
    onSuccess: () => router.push(`/u/${username}`),
    onError: (message) => {
      setError(AUTH_ERRORS[message] ?? message);
      setPin("");
    },
  });

  const pick = (option: StaffLoginOption) => {
    setSelected(option);
    setPin("");
    setError(null);
  };
  const back = () => {
    setSelected(null);
    setPin("");
    setError(null);
  };

  const appendDigit = (digit: string) => {
    setError(null);
    setPin((prev) => (prev.length >= 6 ? prev : prev + digit));
  };
  const backspace = () => setPin((prev) => prev.slice(0, -1));

  const valid = /^\d{4,6}$/.test(pin);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !valid) {
      return;
    }
    setError(null);
    login.execute({ username, employeeCode: selected.employeeCode, pin });
  };

  // Step 1 — pick who you are.
  if (!selected) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="ring-border bg-muted flex size-14 items-center justify-center overflow-hidden rounded-2xl ring-1">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={56}
                height={56}
                className="size-full object-cover"
              />
            ) : (
              <UtensilsCrossedIcon className="text-muted-foreground size-7" />
            )}
          </span>
          <h1 className="text-xl font-bold">{restaurantName}</h1>
          <p className="text-muted-foreground text-sm">Tap your name to sign in</p>
        </div>

        {staff.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No staff can sign in yet. Ask your manager to add you.
          </p>
        ) : (
          <ul className="flex max-h-[60svh] flex-col gap-2 overflow-y-auto">
            {staff.map((option) => (
              <li key={option.employeeCode}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  className="hover:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                >
                  <Avatar
                    name={option.name}
                    photoUrl={option.photoUrl}
                    className="size-11"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {option.name}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ROLE_LABEL[option.role] ?? option.role}
                    </span>
                  </span>
                  <span className="bg-primary text-primary-foreground inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-semibold">
                    Login
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Step 2 — enter the selected staff member's PIN.
  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar
          name={selected.name}
          photoUrl={selected.photoUrl}
          className="size-16"
        />
        <div>
          <h1 className="text-lg font-bold">{selected.name}</h1>
          <button
            type="button"
            onClick={back}
            className="text-muted-foreground text-sm underline"
          >
            Not you? Change
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex h-4 items-center gap-2.5" aria-label="PIN entered">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full transition-colors ${
                i < pin.length ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-16 touch-manipulation rounded-xl text-2xl font-medium select-none"
              onClick={() => appendDigit(key)}
            >
              {key}
            </Button>
          ))}
          <div aria-hidden />
          <Button
            type="button"
            variant="outline"
            className="h-16 touch-manipulation rounded-xl text-2xl font-medium select-none"
            onClick={() => appendDigit("0")}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-16 touch-manipulation select-none"
            onClick={backspace}
            aria-label="Delete last digit"
          >
            <DeleteIcon className="size-6" />
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-center text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={!valid || login.isPending}
      >
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
