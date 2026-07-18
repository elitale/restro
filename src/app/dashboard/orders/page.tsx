import { OrdersBoard } from "@/components/orders/orders-board";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listOrders } from "@/services/order.service";
import { getTodaySales } from "@/services/sales.service";

export default async function OrdersPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Orders" description="Live tickets and today's settlements." />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant to start taking orders."
        />
      </div>
    );
  }

  const [open, completed, sales] = await Promise.all([
    listOrders(ctx.restaurantId, ["OPEN"]),
    listOrders(ctx.restaurantId, ["COMPLETED"]),
    getTodaySales(ctx.restaurantId),
  ]);

  return <OrdersBoard open={open} completed={completed} sales={sales} />;
}
