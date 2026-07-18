"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { addItemsAction } from "@/actions/order.actions";
import { CartLineList } from "@/components/pos/cart-line-list";
import { ItemConfigDialog } from "@/components/pos/item-config-dialog";
import { MenuItemGrid } from "@/components/pos/menu-item-grid";
import { toBillLine } from "@/components/pos/types";
import { useOrderCart } from "@/components/pos/use-order-cart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { formatCurrency } from "@/lib/format";
import { computeBill } from "@/services/billing";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";

export function AddItemsDialog({
  orderId,
  menu,
  onOpenChange,
  onAdded,
}: {
  readonly orderId: string;
  readonly menu: MenuDTO;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAdded: () => void;
}) {
  const cart = useOrderCart();
  const [configItem, setConfigItem] = useState<MenuItemDTO | null>(null);
  const bill = useMemo(
    () => computeBill(cart.cart.map(toBillLine)),
    [cart.cart],
  );

  const onTapItem = (item: MenuItemDTO) => {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setConfigItem(item);
      return;
    }
    cart.quickAdd(item);
  };

  const add = useServerAction(addItemsAction, {
    onSuccess: () => {
      toast.success("Items added to order");
      onOpenChange(false);
      onAdded();
    },
    onError: (message) => toast.error(message),
  });

  const submit = () => {
    if (cart.cart.length === 0) {
      return;
    }
    add.execute({
      orderId,
      items: cart.cart.map((l) => ({
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
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add items</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_320px]">
            <MenuItemGrid menu={menu} onTapItem={onTapItem} />
            <div className="flex min-h-0 flex-col rounded-lg border">
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <CartLineList
                  cart={cart.cart}
                  onChangeQty={cart.changeQty}
                  onToggleComp={cart.toggleComp}
                  onRemove={cart.removeLine}
                />
              </div>
              <div className="border-t p-3">
                <Button
                  className="w-full"
                  disabled={cart.cart.length === 0 || add.isPending}
                  onClick={submit}
                >
                  {add.isPending
                    ? "Adding…"
                    : `Add ${cart.cart.length} ${
                        cart.cart.length === 1 ? "item" : "items"
                      } · ${formatCurrency(bill.grandTotal)}`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {configItem ? (
        <ItemConfigDialog
          item={configItem}
          onAdd={cart.addLine}
          onOpenChange={(open) => {
            if (!open) {
              setConfigItem(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
