import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { RestaurantsTable } from "@/components/admin/restaurants-table";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn, serializeForClient } from "@/lib/utils";
import { restaurantListQuerySchema } from "@/lib/validators/admin";
import { listRestaurants } from "@/services/restaurant.service";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminRestaurantsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = restaurantListQuerySchema.parse({
    search: typeof sp.search === "string" ? sp.search : undefined,
    page: typeof sp.page === "string" ? sp.page : undefined,
  });
  const result = await listRestaurants(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Restaurants"
          description="Onboard and manage restaurants."
        />
        <Link href="/admin/restaurants/new" className={cn(buttonVariants())}>
          <PlusIcon className="size-4" />
          Onboard restaurant
        </Link>
      </div>
      <RestaurantsTable data={serializeForClient(result)} />
    </div>
  );
}
