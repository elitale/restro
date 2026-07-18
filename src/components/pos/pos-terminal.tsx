"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { createOrderAction } from "@/actions/order.actions";
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
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import { computeBill } from "@/services/billing";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";
import type { OrderType } from "@/types/order";
import type { ServiceOptions } from "@/types/settings";
import type { TableDTO } from "@/types/table";

import { CartLineList } from "./cart-line-list";
import { ItemConfigDialog } from "./item-config-dialog";
import { MenuItemGrid } from "./menu-item-grid";
import { TablePicker } from "./table-picker";
import { toBillLine } from "./types";
import { useOrderCart } from "./use-order-cart";

const ORDER_TYPES: readonly {
  value: OrderType;
  label: string;
  key: keyof ServiceOptions;
}[] = [
  { value: "DINE_IN", label: "Dine-in", key: "dineIn" },
  { value: "TAKEAWAY", label: "Takeaway", key: "takeaway" },
  { value: "DELIVERY", label: "Delivery", key: "delivery" },
];

export function PosTerminal({
  menu,
  tables,
  occupied,
  services,
}: {
  readonly menu: MenuDTO;
  readonly tables: readonly TableDTO[];
  readonly occupied: Record<string, string>;
  readonly services: ServiceOptions;
}) {
  const router = useRouter();
  const orderCart = useOrderCart();
  const { cart } = orderCart;
  const enabledTypes = ORDER_TYPES.filter((t) => services[t.key]);
  const [orderType, setOrderType] = useState<OrderType>(
    enabledTypes.find((t) => t.value === services.defaultType)?.value ??
      enabledTypes[0]?.value ??
      "TAKEAWAY",
  );
  const [tableLabel, setTableLabel] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [occupiedConfirm, setOccupiedConfirm] = useState<{
    table: TableDTO;
    orderId: string;
  } | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneSkipped, setPhoneSkipped] = useState(false);
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [configItem, setConfigItem] = useState<MenuItemDTO | null>(null);

  const bill = useMemo(() => computeBill(cart.map(toBillLine)), [cart]);

  const onTapItem = (item: MenuItemDTO) => {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setConfigItem(item);
      return;
    }
    orderCart.quickAdd(item);
  };

  const resetOrder = () => {
    orderCart.clear();
    setTableLabel("");
    setTableId(null);
    setCustomerPhone("");
    setPhoneSkipped(false);
    setCustomerAddress("");
    setOrderNote("");
  };

  const selectTable = (table: TableDTO) => {
    const openOrderId = occupied[table.id];
    if (openOrderId && table.id !== tableId) {
      setOccupiedConfirm({ table, orderId: openOrderId });
      return;
    }
    setTableId(table.id);
  };

  const createOrder = useServerAction(createOrderAction, {
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      toast.success(`Order #${data.orderNumber} sent to kitchen`, {
        action: {
          label: "Print KOT",
          onClick: () => window.open(`/dashboard/orders/${data.id}/kot`, "_blank"),
        },
      });
      resetOrder();
    },
    onError: (message) => toast.error(message),
  });

  const phoneMissing = !phoneSkipped && customerPhone.trim().length === 0;
  const deliveryNeedsAddress =
    orderType === "DELIVERY" && customerAddress.trim().length === 0;
  const canSend =
    cart.length > 0 &&
    !phoneMissing &&
    !deliveryNeedsAddress &&
    !createOrder.isPending;

  const send = () => {
    if (!canSend) {
      return;
    }
    createOrder.execute({
      orderType,
      idempotencyKey: crypto.randomUUID(),
      tableId: orderType === "DINE_IN" ? (tableId ?? undefined) : undefined,
      tableLabel:
        orderType === "DINE_IN" && !tableId
          ? tableLabel.trim() || undefined
          : undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      note: orderNote.trim() || undefined,
      items: cart.map((l) => ({
        menuItemId: l.menuItemId,
        variantId: l.variantId ?? undefined,
        quantity: l.quantity,
        lineNote: l.lineNote ?? undefined,
        isComp: l.isComp,
        modifierIds: l.modifiers.map((m) => m.id),
      })),
    });
  };

  const phoneField = (
    <div className="flex items-center gap-2">
      <Input
        value={customerPhone}
        onChange={(e) => {
          setCustomerPhone(e.target.value);
          if (phoneSkipped) {
            setPhoneSkipped(false);
          }
        }}
        placeholder={phoneSkipped ? "Phone skipped" : "Phone number (required)"}
        inputMode="tel"
        disabled={phoneSkipped}
      />
      {phoneSkipped ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setPhoneSkipped(false)}
        >
          Undo
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            setPhoneSkipped(true);
            setCustomerPhone("");
          }}
        >
          Skip
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <section className="flex min-h-0 flex-1 flex-col">
        <MenuItemGrid menu={menu} onTapItem={onTapItem} />
      </section>

      <aside className="flex min-h-0 w-full flex-col rounded-lg border lg:w-[360px]">
        <div className="flex flex-col gap-3 border-b p-3">
          <div className="flex gap-1">
            {enabledTypes.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={t.value === orderType ? "default" : "outline"}
                onClick={() => setOrderType(t.value)}
                className="flex-1"
              >
                {t.label}
              </Button>
            ))}
          </div>
          {orderType === "DINE_IN" ? (
            <div className="flex flex-col gap-2">
              {tables.length > 0 ? (
                <TablePicker
                  tables={tables}
                  occupied={occupied}
                  selectedId={tableId}
                  onSelect={selectTable}
                />
              ) : (
                <Field>
                  <FieldLabel htmlFor="pos-table">Table</FieldLabel>
                  <Input
                    id="pos-table"
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    placeholder="T1"
                  />
                </Field>
              )}
              {phoneField}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {phoneField}
              {orderType === "DELIVERY" ? (
                <Textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Delivery address"
                  rows={2}
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <CartLineList
            cart={cart}
            onChangeQty={orderCart.changeQty}
            onToggleComp={orderCart.toggleComp}
            onRemove={orderCart.removeLine}
          />
        </div>

        <div className="flex flex-col gap-2 border-t p-3">
          <Textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Order note (optional)"
            rows={1}
          />
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(bill.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST</dt>
              <dd className="tabular-nums">{formatCurrency(bill.taxTotal)}</dd>
            </div>
            {bill.compTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Comp</dt>
                <dd className="tabular-nums">−{formatCurrency(bill.compTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(bill.grandTotal)}</dd>
            </div>
          </dl>
          <Button size="lg" disabled={!canSend} onClick={send}>
            {createOrder.isPending
              ? "Sending…"
              : cart.length === 0
                ? `Send to kitchen · ${formatCurrency(bill.grandTotal)}`
                : phoneMissing
                  ? "Add phone number"
                  : deliveryNeedsAddress
                    ? "Add delivery address"
                    : `Send to kitchen · ${formatCurrency(bill.grandTotal)}`}
          </Button>
        </div>
      </aside>

      {configItem ? (
        <ItemConfigDialog
          item={configItem}
          onAdd={orderCart.addLine}
          onOpenChange={(open) => {
            if (!open) {
              setConfigItem(null);
            }
          }}
        />
      ) : null}

      {occupiedConfirm ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setOccupiedConfirm(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {occupiedConfirm.table.label} has an open order
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              This table already has a running order. Open it to add a round, or
              start a separate new order.
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/orders/${occupiedConfirm.orderId}`)
                }
              >
                Open existing order
              </Button>
              <Button
                onClick={() => {
                  setTableId(occupiedConfirm.table.id);
                  setOccupiedConfirm(null);
                }}
              >
                New order anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
