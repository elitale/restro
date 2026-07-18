import type { ReactNode } from "react";

import { StoreIcon, UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { listUsers } from "@/services/admin-user.service";
import { listRestaurants } from "@/services/restaurant.service";

export default async function AdminOverviewPage() {
  const [users, restaurants] = await Promise.all([
    listUsers({ page: 1, pageSize: 1 }),
    listRestaurants({ page: 1, pageSize: 1 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" description="Platform activity at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<UsersIcon className="size-5" />}
          label="Users"
          value={users.total}
        />
        <StatCard
          icon={<StoreIcon className="size-5" />}
          label="Restaurants"
          value={restaurants.total}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </div>
  );
}
