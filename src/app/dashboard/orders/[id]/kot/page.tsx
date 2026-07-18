import { notFound } from "next/navigation";

import { PrintButton } from "@/components/orders/print-button";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { formatDateTime } from "@/lib/format";
import { getOrder } from "@/services/order.service";

export default async function KotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const order = await getOrder(ctx.restaurantId, id).catch(() => null);
  if (!order) {
    notFound();
  }

  const lines = order.lines.filter((l) => l.state !== "VOID");

  return (
    <div className="mx-auto max-w-sm p-6 font-mono text-sm">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-muted-foreground text-xs">Kitchen ticket</span>
        <PrintButton label="Print KOT" />
      </div>

      <div className="border-b border-dashed pb-2 text-center">
        <p className="text-base font-bold">KOT · #{order.orderNumber}</p>
        <p>{order.orderType.replace("_", "-")}</p>
        {order.tableLabel ? <p>Table {order.tableLabel}</p> : null}
        {order.customerName ? <p>{order.customerName}</p> : null}
        <p className="text-xs">{formatDateTime(order.createdAt)}</p>
      </div>

      <ul className="flex flex-col gap-2 py-3">
        {lines.map((line) => (
          <li key={line.id}>
            <p className="font-bold">
              {line.quantity} × {line.name}
              {line.variantName ? ` (${line.variantName})` : ""}
            </p>
            {line.modifiers.length > 0 ? (
              <p className="pl-4 text-xs">
                {line.modifiers.map((m) => m.name).join(", ")}
              </p>
            ) : null}
            {line.lineNote ? (
              <p className="pl-4 text-xs italic">** {line.lineNote}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="border-t border-dashed pt-2 text-xs italic">
          Note: {order.note}
        </p>
      ) : null}
    </div>
  );
}
