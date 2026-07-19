import { DashboardView } from "@/components/dashboard/dashboard-view"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import { getDashboard } from "@/services/dashboard.service"
import { getLowStockCount } from "@/services/stock.service"

export default async function Page() {
  const ctx = await getManagerContextOrNull()
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Dashboard"
          description="Your restaurant at a glance."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant to start seeing your numbers."
        />
      </div>
    )
  }

  const [data, lowStock] = await Promise.all([
    getDashboard(ctx.restaurantId),
    getLowStockCount(ctx.restaurantId),
  ])

  return <DashboardView data={data} lowStock={lowStock} />
}
