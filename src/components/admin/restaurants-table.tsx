"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types";
import type { RestaurantListItemDTO } from "@/types/admin";

export function RestaurantsTable({
  data,
}: {
  readonly data: Paginated<RestaurantListItemDTO>;
}) {
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No restaurants yet"
        description="Onboard your first restaurant to get started."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Name</th>
            <th className="px-4 py-2.5 text-left font-medium">Owner</th>
            <th className="px-4 py-2.5 text-left font-medium">Location</th>
            <th className="px-4 py-2.5 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((restaurant) => (
            <tr key={restaurant.id} className="[&>td]:px-4 [&>td]:py-3">
              <td>
                <div className="font-medium">{restaurant.name}</div>
                <div className="text-muted-foreground text-xs">
                  /{restaurant.slug}
                </div>
              </td>
              <td>
                <div>{restaurant.ownerName ?? "—"}</div>
                <div className="text-muted-foreground text-xs">
                  {restaurant.ownerPhone}
                </div>
              </td>
              <td className="text-muted-foreground">
                {[restaurant.city, restaurant.country]
                  .filter(Boolean)
                  .join(", ")}
              </td>
              <td>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    restaurant.isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {restaurant.isActive ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted-foreground border-t px-4 py-2 text-xs">
        {data.total} restaurant{data.total === 1 ? "" : "s"}
      </div>
    </div>
  );
}
