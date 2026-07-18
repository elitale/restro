import { InventoryManager } from "@/components/inventory/inventory-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";

export default async function InventoryPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Inventory"
          description="Track the stock you keep in the restaurant."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to add inventory."
        />
      </div>
    );
  }

  const items = await listStock(ctx.restaurantId);
  return <InventoryManager items={items} />;
}
