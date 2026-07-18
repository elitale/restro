"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types";
import type { AdminUserListItemDTO } from "@/types/admin";

const ROLE_LABEL: Record<AdminUserListItemDTO["role"], string> = {
  MANAGER: "Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

const STATUS_CLASS: Record<AdminUserListItemDTO["status"], string> = {
  active: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
  deleted: "bg-muted text-muted-foreground",
};

export function UsersTable({
  data,
}: {
  readonly data: Paginated<AdminUserListItemDTO>;
}) {
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No users yet"
        description="Onboard a restaurant to create the first manager account."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Name</th>
            <th className="px-4 py-2.5 text-left font-medium">Phone</th>
            <th className="px-4 py-2.5 text-left font-medium">Role</th>
            <th className="px-4 py-2.5 text-left font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Restaurants</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((user) => (
            <tr key={user.id} className="[&>td]:px-4 [&>td]:py-3">
              <td className="font-medium">{user.name ?? "—"}</td>
              <td className="text-muted-foreground">{user.phone}</td>
              <td>{ROLE_LABEL[user.role]}</td>
              <td>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    STATUS_CLASS[user.status],
                  )}
                >
                  {user.status}
                </span>
              </td>
              <td className="text-right tabular-nums">{user.restaurantCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted-foreground border-t px-4 py-2 text-xs">
        {data.total} user{data.total === 1 ? "" : "s"}
      </div>
    </div>
  );
}
