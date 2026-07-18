import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StaffManager } from "@/components/staff/staff-manager";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStaff } from "@/services/staff.service";

export default async function StaffPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Staff"
          description="Manage the people who run your restaurant."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to add your team."
        />
      </div>
    );
  }

  const staff = await listStaff(ctx.restaurantId);
  return <StaffManager staff={staff} />;
}
