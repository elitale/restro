import Link from "next/link"

import { SectionCards } from "@/components/section-cards"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import { getLowStockCount } from "@/services/stock.service"

export default async function Page() {
  const ctx = await getManagerContextOrNull()
  const lowStock = ctx ? await getLowStockCount(ctx.restaurantId) : 0

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {lowStock > 0 ? (
            <Link
              href="/dashboard/inventory"
              className="mx-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-6"
            >
              <span>
                <strong>{lowStock}</strong> inventory item
                {lowStock === 1 ? "" : "s"} at or below reorder level.
              </span>
              <span className="font-medium underline">View inventory</span>
            </Link>
          ) : null}
          <SectionCards />
        </div>
      </div>
    </div>
  )
}
