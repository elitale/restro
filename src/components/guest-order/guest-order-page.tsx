"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  guestMyOrdersAction,
  guestPlaceOrderAction,
  guestRequestOtpAction,
  guestVerifyOtpAction,
} from "@/actions/guest-order.actions";
import { PhoneInput } from "@/components/phone-input";
import { ItemConfigDialog } from "@/components/pos/item-config-dialog";
import { linePrice, toBillLine } from "@/components/pos/types";
import { useOrderCart } from "@/components/pos/use-order-cart";
import { MenuBrowser } from "@/components/waiter/menu-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useServerAction } from "@/hooks/use-server-action";
import { computeBill } from "@/services/billing";
import { formatTime, maskPhone } from "@/lib/format";
import {
  guestSessionKey,
  readGuestSession,
  writeGuestSession,
} from "@/lib/guest-cart-storage";
import { uuid } from "@/lib/uuid";
import { phoneSchema } from "@/lib/validators/shared";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";
import type { GuestOrderSummaryDTO } from "@/types/order";

const ERRORS: Record<string, string> = {
  GUEST_OTP_RATE_LIMITED: "Please wait a moment before requesting another code.",
  GUEST_OTP_EXPIRED: "That code expired — request a new one.",
  GUEST_OTP_INVALID: "Incorrect code. Try again.",
  GUEST_OTP_TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code.",
  GUEST_NOT_VERIFIED: "Please verify your phone first.",
  GUEST_ORDER_DISABLED: "Ordering isn't available right now.",
  GUEST_ORDER_TABLE_INVALID: "This table link is invalid. Please ask a server.",
  ITEM_UNAVAILABLE: "An item just sold out. Please review your cart.",
};
const toMessage = (m: string) => ERRORS[m] ?? m;

/** Guest-facing status label + colour for one of their orders. */
const orderStatus = (
  o: GuestOrderSummaryDTO,
): { label: string; className: string } => {
  if (o.status === "COMPLETED") {
    return { label: "Paid", className: "bg-slate-100 text-slate-700" };
  }
  if (o.status === "VOID") {
    return { label: "Cancelled", className: "bg-red-100 text-red-800" };
  }
  switch (o.kitchenStatus) {
    case "WAITING":
      return { label: "In queue", className: "bg-amber-100 text-amber-900" };
    case "PREPARING":
      return { label: "Preparing", className: "bg-sky-100 text-sky-900" };
    case "READY":
      return { label: "Ready", className: "bg-emerald-100 text-emerald-900" };
    default:
      return { label: "Served", className: "bg-slate-100 text-slate-700" };
  }
};

export function GuestOrderPage({
  username,
  tableId,
  tableLabel,
  restaurantName,
  menu,
  initiallyVerified,
  verifiedPhoneMasked,
  initialOrders,
}: {
  readonly username: string;
  readonly tableId: string;
  readonly tableLabel: string;
  readonly restaurantName: string;
  readonly menu: MenuDTO;
  readonly initiallyVerified: boolean;
  readonly verifiedPhoneMasked: string | null;
  readonly initialOrders: readonly GuestOrderSummaryDTO[];
}) {
  const cart = useOrderCart();
  const [configItem, setConfigItem] = useState<MenuItemDTO | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verified, setVerified] = useState(initiallyVerified);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [myOrders, setMyOrders] =
    useState<readonly GuestOrderSummaryDTO[]>(initialOrders);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const idempotencyKey = useRef(uuid());

  // Persist the in-progress cart + verified marker per table (localStorage), so
  // a refresh or a return to add another item doesn't lose the draft. The
  // server cookie stays authoritative for verification; this is convenience.
  const storageKey = guestSessionKey(username, tableId);
  const { replaceAll } = cart;
  const restoredRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const saved = readGuestSession(storageKey);
      if (saved) {
        if (saved.lines.length > 0) {
          replaceAll(saved.lines);
        }
        if (saved.verified) {
          setVerified(true);
        }
      }
      restoredRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [storageKey, replaceAll]);

  useEffect(() => {
    // Only persist after the initial restore, so we never clobber the saved
    // draft with the empty mount state.
    if (!restoredRef.current) {
      return;
    }
    writeGuestSession(storageKey, { lines: cart.cart, verified });
  }, [storageKey, cart.cart, verified]);

  const refreshOrders = useCallback(async () => {
    const res = await guestMyOrdersAction();
    if (res.success) {
      setMyOrders(res.data ?? []);
    }
  }, []);

  // Poll the guest's own orders every 10s so status (Preparing → Ready → Paid)
  // stays live while they watch.
  useEffect(() => {
    if (!verified) {
      return;
    }
    const id = setInterval(() => {
      void refreshOrders();
    }, 10000);
    return () => clearInterval(id);
  }, [verified, refreshOrders]);

  const bill = useMemo(
    () => computeBill(cart.cart.map(toBillLine)),
    [cart.cart],
  );
  const itemCount = cart.cart.reduce((s, l) => s + l.quantity, 0);

  const items = () =>
    cart.cart.map((l) => ({
      menuItemId: l.menuItemId,
      variantId: l.variantId ?? undefined,
      quantity: l.quantity,
      lineNote: l.lineNote ?? undefined,
      isComp: false,
      modifierIds: l.modifiers.map((m) => m.id),
    }));

  const place = useServerAction(guestPlaceOrderAction, {
    onSuccess: () => {
      setReviewOpen(false);
      setVerifyOpen(false);
      // Clear the draft (the write effect persists the empty cart), but keep
      // the verified marker so "Order more" stays one tap.
      cart.clear();
      idempotencyKey.current = uuid();
      setPlaced(true);
      void refreshOrders();
    },
    onError: (m) => {
      // The session cookie expired (or was never set on this device) — fall
      // back to phone verification instead of a dead end.
      if (m === "GUEST_NOT_VERIFIED") {
        setVerified(false);
        setOtpSent(false);
        setVerifyOpen(true);
      }
      toast.error(toMessage(m));
    },
  });

  const submitOrder = () => {
    if (itemCount === 0) {
      return;
    }
    place.execute({
      username,
      tableId,
      idempotencyKey: idempotencyKey.current,
      items: items(),
    });
  };

  const sendCode = useServerAction(guestRequestOtpAction, {
    onSuccess: () => {
      setOtpSent(true);
      toast.success("Code sent");
    },
    onError: (m) => toast.error(toMessage(m)),
  });

  const verify = useServerAction(guestVerifyOtpAction, {
    onSuccess: () => {
      setVerified(true);
      void refreshOrders();
      submitOrder();
    },
    onError: (m) => toast.error(toMessage(m)),
  });

  const onPlaceTap = () => {
    if (verified) {
      submitOrder();
      return;
    }
    setReviewOpen(false);
    setVerifyOpen(true);
  };

  const phoneValid = phoneSchema.safeParse(phone).success;
  const codeValid = /^\d{6}$/.test(code);
  const busy = place.isPending || verify.isPending;

  const onQuickAdd = (item: MenuItemDTO) => {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setConfigItem(item);
      return;
    }
    cart.quickAdd(item);
  };

  if (placed) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full text-3xl">
          ✓
        </div>
        <h1 className="text-xl font-semibold">Order placed</h1>
        <p className="text-muted-foreground text-sm">
          Your order for <span className="font-medium">{tableLabel}</span> has
          been sent to the kitchen. A server will bring it over.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button
            onClick={() => {
              setPlaced(false);
              setOrdersOpen(true);
            }}
          >
            Track your orders
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              cart.clear();
              idempotencyKey.current = uuid();
              setPlaced(false);
            }}
          >
            Order more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col p-4 pb-28">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{restaurantName}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span>
              Ordering for <span className="font-medium">{tableLabel}</span>
            </span>
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                ✓ Verified
                {(verifiedPhoneMasked ?? (phone ? maskPhone(phone) : null))
                  ? ` · ${verifiedPhoneMasked ?? maskPhone(phone)}`
                  : ""}
              </span>
            ) : null}
          </p>
        </div>
        {verified && myOrders.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setOrdersOpen(true)}
          >
            Your orders ({myOrders.length})
          </Button>
        ) : null}
      </div>

      <MenuBrowser menu={menu} onQuickAdd={onQuickAdd} onOpenDetail={setConfigItem} />

      {/* Pinned bottom bar */}
      <div className="bg-background fixed inset-x-0 bottom-0 border-t p-3">
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <button
            type="button"
            className="flex-1 text-left disabled:opacity-50"
            disabled={itemCount === 0}
            onClick={() => setReviewOpen(true)}
          >
            <span className="block text-sm font-medium">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
            <span className="text-muted-foreground text-xs">
              ₹{bill.grandTotal.toFixed(0)} · Review
            </span>
          </button>
          <Button
            size="lg"
            className="h-12"
            disabled={itemCount === 0 || busy}
            onClick={onPlaceTap}
          >
            {busy ? "Placing…" : "Place order"}
          </Button>
        </div>
      </div>

      {configItem ? (
        <ItemConfigDialog
          item={configItem}
          onAdd={cart.addLine}
          onOpenChange={(open) => !open && setConfigItem(null)}
        />
      ) : null}

      {/* Review sheet */}
      {reviewOpen ? (
        <Dialog open onOpenChange={setReviewOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your order</DialogTitle>
            </DialogHeader>
            {cart.cart.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Your cart is empty.
              </p>
            ) : (
              <ul className="divide-y">
                {cart.cart.map((l) => (
                  <li key={l.key} className="flex items-start gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {l.name}
                        {l.variantName ? ` · ${l.variantName}` : ""}
                      </p>
                      {l.modifiers.length > 0 || l.lineNote ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {[
                            l.modifiers.map((m) => m.name).join(", "),
                            l.lineNote,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => cart.changeQty(l.key, -1)}
                        >
                          <MinusIcon className="size-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {l.quantity}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => cart.changeQty(l.key, 1)}
                        >
                          <PlusIcon className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground ml-auto size-7"
                          onClick={() => cart.removeLine(l.key)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">
                      ₹{linePrice(l).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Total</span>
              <span className="text-base font-semibold tabular-nums">
                ₹{bill.grandTotal.toFixed(2)}
              </span>
            </div>
            <DialogFooter>
              <Button
                className="h-12 w-full text-base"
                disabled={itemCount === 0 || busy}
                onClick={onPlaceTap}
              >
                {busy ? "Placing…" : verified ? "Place order" : "Verify & place"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Phone verification */}
      {verifyOpen ? (
        <Dialog open onOpenChange={(o) => !busy && setVerifyOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Verify your phone</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              We&apos;ll text you a one-time code to confirm your order.
            </p>
            <div className="flex flex-col gap-3">
              <PhoneInput onChange={setPhone} disabled={otpSent || busy} />
              {otpSent ? (
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  className="h-11 text-center text-lg tracking-widest"
                />
              ) : null}
            </div>
            <DialogFooter>
              {otpSent ? (
                <Button
                  className="h-12 w-full text-base"
                  disabled={!codeValid || busy}
                  onClick={() =>
                    verify.execute({ username, tableId, phone, code })
                  }
                >
                  {busy ? "Placing…" : "Verify & place order"}
                </Button>
              ) : (
                <Button
                  className="h-12 w-full text-base"
                  disabled={!phoneValid || sendCode.isPending}
                  onClick={() =>
                    sendCode.execute({ username, tableId, phone })
                  }
                >
                  {sendCode.isPending ? "Sending…" : "Send code"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Your orders */}
      <Sheet open={ordersOpen} onOpenChange={setOrdersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Your orders</SheetTitle>
          </SheetHeader>
          {myOrders.length === 0 ? (
            <p className="text-muted-foreground px-4 pb-6 text-sm">
              No orders yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 px-4 pb-6">
              {myOrders.map((o) => {
                const st = orderStatus(o);
                return (
                  <li key={o.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {o.tableLabel ?? `#${o.orderNumber}`}
                        <span className="text-muted-foreground font-normal">
                          {" "}· {formatTime(o.createdAt)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-0.5">
                      {o.lines.map((l, i) => (
                        <li
                          key={`${o.id}-${i}`}
                          className="text-muted-foreground flex justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate">
                            <span className="tabular-nums">{l.quantity}×</span>{" "}
                            {l.name}
                            {l.variantName ? ` · ${l.variantName}` : ""}
                          </span>
                          {l.state === "SERVED" ? <span>Served</span> : null}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                      <span>
                        {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="font-semibold tabular-nums">
                        ₹{o.total.toFixed(2)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
