import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { TaxSettingsForm } from "@/components/settings/tax-settings-form"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import { getTaxProfile } from "@/services/restaurant-settings.service"

export default async function SettingsPage() {
  const ctx = await getManagerContextOrNull()
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Settings"
          description="Manage your restaurant configuration."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant first."
        />
      </div>
    )
  }

  const profile = await getTaxProfile(ctx.restaurantId)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Settings"
        description="Tax & GST configuration for your restaurant."
      />
      <TaxSettingsForm profile={profile} />
    </div>
  )
}
