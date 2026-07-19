import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/orders/print-button";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { getOrder } from "@/services/order.service";
import type { OrderLineDTO } from "@/types/order";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number): string => n.toFixed(2);

const TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Dine In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

const unitPrice = (line: OrderLineDTO): number =>
  line.unitPrice + line.modifiers.reduce((s, m) => s + m.priceDelta, 0);

const lineAmount = (line: OrderLineDTO): number =>
  line.isComp ? 0 : unitPrice(line) * line.quantity;

const dateIST = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  });

const timeIST = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });

function Hr() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

function TotalRow({
  label,
  value,
  bold,
}: {
  readonly label: string;
  readonly value: string;
  readonly bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

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
  const lines = order.lines.filter((l) => l.state !== "VOID");
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const cgst = round2(order.taxTotal / 2);
  const sgst = round2(order.taxTotal - cgst);

  // Show the GST rate only when every taxable line shares one rate.
  const taxableRates = new Set(
    lines.filter((l) => !l.isComp && l.taxRate > 0).map((l) => l.taxRate),
  );
  const halfRate = taxableRates.size === 1 ? [...taxableRates][0] / 2 : null;
  const rateSuffix = halfRate != null ? `@${halfRate}%` : "";

  const addressLine = [
    restaurant.addressLine1,
    restaurant.addressLine2,
    [restaurant.city, restaurant.state].filter(Boolean).join(", "),
    restaurant.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const roundOffLabel =
    order.roundOff === 0
      ? null
      : `${order.roundOff > 0 ? "+" : "−"}${money(Math.abs(order.roundOff))}`;

  const footer =
    restaurant.invoiceFooterNote?.trim() || "Thank you! Visit again.";

  return (
    <div className="mx-auto w-full max-w-[320px] p-4 font-mono text-[12px] leading-tight text-black">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-muted-foreground text-xs">
          {registered ? "Tax invoice" : "Bill of supply"}
        </span>
        <PrintButton label="Print invoice" />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-bold tracking-wide">
          {registered ? "TAX INVOICE" : "BILL OF SUPPLY"}
          {copy === "1" ? " (DUPLICATE)" : ""}
        </p>
        {restaurant.legalName ? (
          <p className="uppercase">{restaurant.legalName}</p>
        ) : null}
        <p className="text-sm font-bold uppercase">{restaurant.name}</p>
        {restaurant.tagline ? <p>{restaurant.tagline}</p> : null}
        {addressLine ? <p>{addressLine}</p> : null}
        {restaurant.phone ? <p>M: {restaurant.phone}</p> : null}
        {registered && restaurant.gstin ? (
          <p>GSTIN: {restaurant.gstin}</p>
        ) : null}
        {restaurant.fssaiLicense ? (
          <p>FSSAI: {restaurant.fssaiLicense}</p>
        ) : null}
      </div>

      <Hr />

      {/* Meta */}
      <div className="flex flex-col gap-0.5">
        {order.customerName ? <p>Name: {order.customerName}</p> : null}
        <div className="flex justify-between">
          <span>Date: {order.settledAt ? dateIST(order.settledAt) : ""}</span>
          <span className="font-bold">
            {TYPE_LABEL[order.orderType] ?? order.orderType}
            {order.orderType === "DINE_IN" && order.tableLabel
              ? `: ${order.tableLabel}`
              : ""}
          </span>
        </div>
        {order.settledAt ? <span>{timeIST(order.settledAt)}</span> : null}
        <div className="flex justify-between">
          <span>Bill No.: {order.invoiceNumber ?? order.orderNumber}</span>
          <span>Token No.: {order.orderNumber}</span>
        </div>
      </div>

      <Hr />

      {/* Items */}
      <div className="flex font-bold">
        <span className="flex-1">Item</span>
        <span className="w-8 text-right">Qty</span>
        <span className="w-14 text-right">Price</span>
        <span className="w-16 text-right">Amount</span>
      </div>
      <Hr />
      <div className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <div key={line.id} className="flex">
            <span className="flex-1 pr-1">
              {line.name}
              {line.variantName ? ` (${line.variantName})` : ""}
              {line.isComp ? " — comp" : ""}
            </span>
            <span className="w-8 text-right tabular-nums">{line.quantity}</span>
            <span className="w-14 text-right tabular-nums">
              {money(unitPrice(line))}
            </span>
            <span className="w-16 text-right tabular-nums">
              {money(lineAmount(line))}
            </span>
          </div>
        ))}
      </div>

      <Hr />

      {/* Totals */}
      <div className="flex flex-col gap-0.5">
        <TotalRow
          label={`Sub Total  Qty: ${totalQty}`}
          value={money(order.subtotal)}
        />
        {order.discountTotal > 0 ? (
          <TotalRow label="Discount" value={`−${money(order.discountTotal)}`} />
        ) : null}
        {registered ? (
          <>
            <TotalRow label={`SGST${rateSuffix}`} value={money(sgst)} />
            <TotalRow label={`CGST${rateSuffix}`} value={money(cgst)} />
          </>
        ) : null}
        {roundOffLabel ? (
          <TotalRow label="Round off" value={roundOffLabel} />
        ) : null}
      </div>

      <Hr />

      <TotalRow
        label="Grand Total"
        value={formatCurrency(order.grandTotal)}
        bold
      />

      <Hr />

      <p className="whitespace-pre-line text-center">{footer}</p>
    </div>
  );
}
