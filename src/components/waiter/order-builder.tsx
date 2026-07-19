"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  addWaiterItemsAction,
  createWaiterOrderAction,
} from "@/actions/staff-order.actions";
import { ItemConfigDialog } from "@/components/pos/item-config-dialog";
import { modifiersDelta, orderRunningTotal, toBillLine } from "@/components/pos/types";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { computeBill } from "@/services/billing";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";
import type { OrderDTO, OrderType } from "@/types/order";
import type { ServiceOptions } from "@/types/settings";
import type { TableDTO } from "@/types/table";

const AUTH_ERRORS: Record<string, string> = {
  STAFF_FORBIDDEN: "You don't have permission to do that.",
  NO_STAFF_SESSION: "Session expired. Please sign in again.",
};
const toMessage = (m: string) => AUTH_ERRORS[m] ?? m;

const groupBySection = (
  tables: readonly TableDTO[],
): [string, TableDTO[]][] => {
  const groups = new Map<string, TableDTO[]>();
  for (const t of tables) {
    const key = t.section?.trim() || "Tables";
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  return [...groups.entries()];
};

export function OrderBuilder({
  mode,
  username,
  menu,
  tables,
  occupied,
  services,
  existingOrder,
}: {
  readonly mode: "new" | "add";
  readonly username: string;
  readonly menu: MenuDTO;
  readonly tables: readonly TableDTO[];
  readonly occupied: Record<string, string>;
  readonly services: ServiceOptions;
  readonly existingOrder?: OrderDTO;
}) {
  const router = useRouter();
  const cart = useOrderCart();

  const allowTakeaway = services.takeaway;
  const allowDineIn = services.dineIn;
  const [orderType, setOrderType] = useState<OrderType>(
    services.defaultType === "TAKEAWAY" && allowTakeaway
      ? "TAKEAWAY"
      : allowDineIn
        ? "DINE_IN"
        : "TAKEAWAY",
  );
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [configItem, setConfigItem] = useState<MenuItemDTO | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const idempotencyKey = useRef(crypto.randomUUID());

  const bill = useMemo(
    () => computeBill(cart.cart.map(toBillLine)),
    [cart.cart],
  );
  const itemCount = cart.cart.reduce((s, l) => s + l.quantity, 0);
  const selectedTable = tables.find((t) => t.id === tableId) ?? null;
  const tableName = selectedTable?.label ?? (tableLabel.trim() || null);

  const sentLines = existingOrder?.lines.filter((l) => l.state !== "VOID") ?? [];
  const existingTotal = useMemo(
    () => (existingOrder ? orderRunningTotal(existingOrder) : 0),
    [existingOrder],
  );
  const lineAmount = (l: OrderDTO["lines"][number]) =>
    l.isComp ? 0 : (l.unitPrice + modifiersDelta(l.modifiers)) * l.quantity;

  const done = () => {
    toast.success(mode === "new" ? "Sent to kitchen ✓" : "Items sent ✓");
    cart.clear();
    idempotencyKey.current = crypto.randomUUID();
    router.push(`/u/${username}`);
  };

  const createOrder = useServerAction(createWaiterOrderAction, {
    onSuccess: done,
    onError: (m) => toast.error(toMessage(m)),
  });
  const addItems = useServerAction(addWaiterItemsAction, {
    onSuccess: done,
    onError: (m) => toast.error(toMessage(m)),
  });

  const isPending = createOrder.isPending || addItems.isPending;
  const needsTable = mode === "new" && orderType === "DINE_IN" && !tableName;
  const canSend = itemCount > 0 && !needsTable && !isPending;

  const items = () =>
    cart.cart.map((l) => ({
      menuItemId: l.menuItemId,
      variantId: l.variantId ?? undefined,
      quantity: l.quantity,
      lineNote: l.lineNote ?? undefined,
      isComp: false,
      modifierIds: l.modifiers.map((m) => m.id),
    }));

  const send = () => {
    if (!canSend) {
      return;
    }
    if (mode === "add" && existingOrder) {
      addItems.execute({ orderId: existingOrder.id, items: items() });
      return;
    }
    createOrder.execute({
      orderType,
      idempotencyKey: idempotencyKey.current,
      tableId: orderType === "DINE_IN" ? (tableId ?? undefined) : undefined,
      tableLabel:
        orderType === "DINE_IN" && !tableId
          ? tableLabel.trim() || undefined
          : undefined,
      customerPhone: phone.trim() || undefined,
      items: items(),
    });
  };

  const onTapItem = (item: MenuItemDTO) => {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setConfigItem(item);
      return;
    }
    cart.quickAdd(item);
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col p-4 pb-28">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/u/${username}`)}
        >
          ← Back
        </Button>
        <span className="ml-auto text-sm font-medium">
          {mode === "add"
            ? existingOrder?.tableLabel ?? `#${existingOrder?.orderNumber}`
            : "New order"}
        </span>
      </div>

      {mode === "new" ? (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            {allowDineIn ? (
              <Button
                variant={orderType === "DINE_IN" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setOrderType("DINE_IN")}
              >
                Dine-in
              </Button>
            ) : null}
            {allowTakeaway ? (
              <Button
                variant={orderType === "TAKEAWAY" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setOrderType("TAKEAWAY")}
              >
                Takeaway
              </Button>
            ) : null}
          </div>
          {orderType === "DINE_IN" ? (
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => setTableOpen(true)}
            >
              {tableName ? `Table: ${tableName}` : "Select a table"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === "add" && existingOrder ? (
        <div className="mb-3 rounded-xl border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Sent to kitchen</span>
            <span className="text-muted-foreground text-xs">Read-only</span>
          </div>
          <ul className="divide-y">
            {sentLines.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-3 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="text-sm">
                    <span className="tabular-nums">{l.quantity}×</span> {l.name}
                    {l.variantName ? ` · ${l.variantName}` : ""}
                  </span>
                  {l.modifiers.length > 0 ||
                  l.lineNote ||
                  l.state === "SERVED" ||
                  l.isComp ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {[
                        l.modifiers.map((m) => m.name).join(", "),
                        l.lineNote,
                        l.state === "SERVED" ? "Served" : null,
                        l.isComp ? "Comp" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {l.isComp ? "—" : `₹${lineAmount(l).toFixed(0)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-sm font-medium">Order total</span>
            <span className="text-sm font-semibold tabular-nums">
              ₹{existingTotal.toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}

      <MenuBrowser menu={menu} onTapItem={onTapItem} />

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
            disabled={!canSend}
            onClick={send}
          >
            {isPending ? "Sending…" : needsTable ? "Pick a table" : "Send"}
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

      {/* Table picker */}
      {tableOpen ? (
        <Dialog open onOpenChange={setTableOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select a table</DialogTitle>
            </DialogHeader>
            {tables.length === 0 ? (
              <Field>
                <FieldLabel htmlFor="tl">Table name</FieldLabel>
                <Input
                  id="tl"
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  placeholder="T1"
                  className="h-11 text-base"
                />
              </Field>
            ) : (
              <div className="flex flex-col gap-4">
                {groupBySection(tables).map(([section, group]) => (
                  <div key={section} className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      {section}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {group.map((t) => (
                        <Button
                          key={t.id}
                          variant={t.id === tableId ? "default" : "outline"}
                          className="relative h-14"
                          onClick={() => {
                            setTableId(t.id);
                            setTableLabel("");
                            setTableOpen(false);
                          }}
                        >
                          {t.label}
                          {occupied[t.id] ? (
                            <span className="absolute top-1 right-1 size-2 rounded-full bg-amber-500" />
                          ) : null}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tables.length === 0 ? (
              <DialogFooter>
                <Button onClick={() => setTableOpen(false)}>Done</Button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Cart review */}
      {reviewOpen ? (
        <Dialog open onOpenChange={setReviewOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review order</DialogTitle>
            </DialogHeader>
            <ul className="flex flex-col divide-y">
              {cart.cart.map((l) => (
                <li key={l.key} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.name}
                      {l.variantName ? ` · ${l.variantName}` : ""}
                    </p>
                    {l.modifiers.length > 0 || l.lineNote ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {[l.modifiers.map((m) => m.name).join(", "), l.lineNote]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => cart.changeQty(l.key, -1)}
                      aria-label="Decrease"
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <span className="w-5 text-center text-sm tabular-nums">
                      {l.quantity}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => cart.changeQty(l.key, 1)}
                      aria-label="Increase"
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => cart.removeLine(l.key)}
                      aria-label="Remove"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {mode === "new" ? (
              <Field>
                <FieldLabel htmlFor="phone">Customer phone (optional)</FieldLabel>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Skip if not needed"
                  inputMode="tel"
                  className="h-11 text-base"
                />
              </Field>
            ) : null}

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">
                ₹{bill.grandTotal.toFixed(2)}
              </span>
            </div>

            <DialogFooter>
              <Button
                size="lg"
                className="h-12 w-full"
                disabled={!canSend}
                onClick={() => {
                  setReviewOpen(false);
                  send();
                }}
              >
                {isPending ? "Sending…" : "Send to kitchen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
