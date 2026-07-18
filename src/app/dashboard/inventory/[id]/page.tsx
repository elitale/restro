import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { MOVEMENT_LABELS, UNIT_LABELS } from "@/lib/inventory";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { cn } from "@/lib/utils";
import { getStockItem, listMovements } from "@/services/stock.service";

export default async function StockHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const item = await getStockItem(ctx, id).catch(() => null);
  if (!item) {
    notFound();
  }
  const movements = await listMovements(ctx, id);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={item.name}
          description={`On hand ${item.onHand} ${UNIT_LABELS[item.unit]}`}
        />
        <Button variant="outline" render={<Link href="/dashboard/inventory" />}>
          Back to inventory
        </Button>
      </div>

      {movements.length === 0 ? (
        <p className="text-muted-foreground text-sm">No movements yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{MOVEMENT_LABELS[m.type]}</p>
                <p className="text-muted-foreground text-xs">
                  {m.reason ? `${m.reason} · ` : ""}
                  {formatDateTime(m.createdAt)}
                  {m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <span
                  className={cn(
                    "text-sm font-medium",
                    m.quantity < 0 ? "text-destructive" : "text-green-700",
                  )}
                >
                  {m.quantity > 0 ? "+" : ""}
                  {m.quantity}
                </span>
                <p className="text-muted-foreground text-xs">
                  → {m.resultingOnHand} {UNIT_LABELS[item.unit]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
