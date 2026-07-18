import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/orders/print-button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { getOrder } from "@/services/order.service";
import type { OrderLineDTO } from "@/types/order";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const lineGross = (line: OrderLineDTO): number =>
  line.isComp
    ? 0
    : (line.unitPrice + line.modifiers.reduce((s, m) => s + m.priceDelta, 0)) *
      line.quantity;

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const { copy } = await searchParams;
  const [order, restaurant] = await Promise.all([
    getOrder(ctx.restaurantId, id).catch(() => null),
    findRestaurantById(ctx.restaurantId),
  ]);
  if (!order || !restaurant) {
    notFound();
  }

  if (order.status !== "COMPLETED") {
    return (
      <div className="mx-auto max-w-sm p-6 text-center text-sm">
        <p>This order hasn&apos;t been settled yet.</p>
        <Link href={`/dashboard/orders/${order.id}`} className="underline">
          Back to order
        </Link>
      </div>
    );
  }

  const registered = restaurant.gstRegistrationType !== "UNREGISTERED";
  const cgst = round2(order.taxTotal / 2);
  const sgst = round2(order.taxTotal - cgst);
  const lines = order.lines.filter((l) => l.state !== "VOID");

  return (
    <div className="mx-auto max-w-sm p-6 text-sm">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-muted-foreground text-xs">
          {registered ? "Tax invoice" : "Bill of supply"}
        </span>
        <PrintButton label="Print invoice" />
      </div>

      <div className="text-center">
        <h1 className="text-lg font-bold">{restaurant.name}</h1>
        {restaurant.city ? <p className="text-xs">{restaurant.city}</p> : null}
        {restaurant.phone ? <p className="text-xs">{restaurant.phone}</p> : null}
        {registered && restaurant.gstin ? (
          <p className="text-xs">GSTIN: {restaurant.gstin}</p>
        ) : null}
        <p className="mt-2 font-semibold">
          {registered ? "TAX INVOICE" : "BILL OF SUPPLY"}
          {copy === "1" ? " (DUPLICATE)" : ""}
        </p>
      </div>

      <div className="mt-3 flex justify-between border-y border-dashed py-2 text-xs">
        <span>
          Invoice: {order.invoiceNumber ?? order.orderNumber}
          <br />
          Order: #{order.orderNumber}
        </span>
        <span className="text-right">
          {order.settledAt ? formatDateTime(order.settledAt) : ""}
          {order.customerName ? (
            <>
              <br />
              {order.customerName}
            </>
          ) : null}
        </span>
      </div>

      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="border-b border-dashed text-left">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 text-center font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="py-1">
                {line.name}
                {line.variantName ? ` (${line.variantName})` : ""}
                {line.isComp ? " — comp" : ""}
              </td>
              <td className="py-1 text-center tabular-nums">{line.quantity}</td>
              <td className="py-1 text-right tabular-nums">
                {formatCurrency(lineGross(line))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 flex flex-col gap-1 border-t border-dashed pt-2 text-xs">
        <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
        {order.discountTotal > 0 ? (
          <Row label="Discount" value={`−${formatCurrency(order.discountTotal)}`} />
        ) : null}
        {registered ? (
          <>
            <Row label="CGST" value={formatCurrency(cgst)} />
            <Row label="SGST" value={formatCurrency(sgst)} />
          </>
        ) : null}
        {order.roundOff !== 0 ? (
          <Row label="Round off" value={formatCurrency(order.roundOff)} />
        ) : null}
        <div className="flex justify-between border-t border-dashed pt-1 text-sm font-bold">
          <dt>Grand total</dt>
          <dd className="tabular-nums">{formatCurrency(order.grandTotal)}</dd>
        </div>
      </dl>

      <dl className="mt-2 flex flex-col gap-1 text-xs">
        {order.payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <dt>{p.mode}</dt>
            <dd className="tabular-nums">{formatCurrency(p.amount)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-center text-xs">Thank you! Visit again.</p>
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
