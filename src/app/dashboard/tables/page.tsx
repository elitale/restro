import { TablesManager } from "@/components/tables/tables-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getSelfOrderShareInfo } from "@/services/restaurant-settings.service";
import { listTablesForManager } from "@/services/table.service";

export default async function TablesPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Tables"
          description="Set up your floor so servers can seat dine-in orders."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to add tables."
        />
      </div>
    );
  }

  const [tables, share] = await Promise.all([
    listTablesForManager(ctx.restaurantId),
    getSelfOrderShareInfo(ctx.restaurantId),
  ]);
  return (
    <TablesManager
      tables={tables}
      username={share.username}
      selfOrderEnabled={share.enabled}
    />
  );
}
