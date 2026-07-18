import { PosTerminal } from "@/components/pos/pos-terminal";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getMenu } from "@/services/menu-item.service";
import { listOrders } from "@/services/order.service";
import { getServiceOptions } from "@/services/restaurant-settings.service";
import { getTables } from "@/services/table.service";

export default async function PosPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="POS" description="Take orders and send them to the kitchen." />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to start taking orders."
        />
      </div>
    );
  }

  const [menu, tables, openOrders, services] = await Promise.all([
    getMenu(ctx.restaurantId),
    getTables(ctx.restaurantId),
    listOrders(ctx.restaurantId, ["OPEN"]),
    getServiceOptions(ctx.restaurantId),
  ]);

  const occupied: Record<string, string> = {};
  for (const order of openOrders) {
    if (order.tableId) {
      occupied[order.tableId] = order.id;
    }
  }

  return (
    <PosTerminal
      menu={menu}
      tables={tables}
      occupied={occupied}
      services={services}
    />
  );
}
