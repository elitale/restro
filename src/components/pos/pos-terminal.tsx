"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { createOrderAction } from "@/actions/order.actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import { computeBill } from "@/services/billing";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";
import type { OrderType } from "@/types/order";

import { CartLineList } from "./cart-line-list";
import { ItemConfigDialog } from "./item-config-dialog";
import { MenuItemGrid } from "./menu-item-grid";
import { toBillLine } from "./types";
import { useOrderCart } from "./use-order-cart";

const ORDER_TYPES: readonly { value: OrderType; label: string }[] = [
  { value: "DINE_IN", label: "Dine-in" },
  { value: "TAKEAWAY", label: "Takeaway" },
  { value: "DELIVERY", label: "Delivery" },
];

export function PosTerminal({ menu }: { readonly menu: MenuDTO }) {
  const orderCart = useOrderCart();
  const { cart } = orderCart;
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [tableLabel, setTableLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNote("");
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

  const deliveryNeedsAddress =
    orderType === "DELIVERY" && customerAddress.trim().length === 0;
  const canSend = cart.length > 0 && !deliveryNeedsAddress && !createOrder.isPending;

  const send = () => {
    if (!canSend) {
      return;
    }
    createOrder.execute({
      orderType,
      idempotencyKey: crypto.randomUUID(),
      tableLabel: tableLabel.trim() || undefined,
      customerName: customerName.trim() || undefined,
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <section className="flex min-h-0 flex-1 flex-col">
        <MenuItemGrid menu={menu} onTapItem={onTapItem} />
      </section>

      <aside className="flex min-h-0 w-full flex-col rounded-lg border lg:w-[360px]">
        <div className="flex flex-col gap-3 border-b p-3">
          <div className="grid grid-cols-3 gap-1">
            {ORDER_TYPES.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={t.value === orderType ? "default" : "outline"}
                onClick={() => setOrderType(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {orderType === "DINE_IN" ? (
            <Field>
              <FieldLabel htmlFor="pos-table">Table</FieldLabel>
              <Input
                id="pos-table"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                placeholder="T1"
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  inputMode="tel"
                />
              </div>
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
    </div>
  );
}
