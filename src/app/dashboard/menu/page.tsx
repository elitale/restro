import { MenuManager } from "@/components/menu/menu-manager"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import { findRestaurantById } from "@/repositories/restaurant.repository"
import { getMenu } from "@/services/menu-item.service"
import { listModifierGroups } from "@/services/modifier.service"

export default async function MenuPage() {
  const ctx = await getManagerContextOrNull()
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Menu"
          description="Manage your categories, dishes, prices and availability."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to build your menu."
        />
      </div>
    )
  }

  const [menu, groups, restaurant] = await Promise.all([
    getMenu(ctx.restaurantId),
    listModifierGroups(ctx.restaurantId),
    findRestaurantById(ctx.restaurantId),
  ])

  return (
    <MenuManager
      menu={menu}
      groups={groups}
      gstRegistered={restaurant?.gstRegistrationType !== "UNREGISTERED"}
    />
  )
}
