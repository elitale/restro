import { GalleryManager } from "@/components/settings/gallery-manager"
import { InvoiceFooterCard } from "@/components/settings/invoice-footer-card"
import { ProfileHeader } from "@/components/settings/profile-header"
import { RestaurantProfileForm } from "@/components/settings/restaurant-profile-form"
import { SelfOrderCard } from "@/components/settings/self-order-card"
import { SignInPinCard } from "@/components/settings/sign-in-pin-card"
import { TaxSettingsForm } from "@/components/settings/tax-settings-form"
import { UsernameCard } from "@/components/settings/username-card"
import { VideosManager } from "@/components/settings/videos-manager"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import {
  getInvoiceFooterNote,
  getRestaurantProfile,
  getSelfOrderEnabled,
  getTaxProfile,
} from "@/services/restaurant-settings.service"
import { getPinStatus } from "@/services/pin-auth.service"

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

  const [profile, taxProfile] = await Promise.all([
    getRestaurantProfile(ctx.restaurantId),
    getTaxProfile(ctx.restaurantId),
  ])
  const pinStatus = await getPinStatus(ctx.userId)
  const selfOrderEnabled = await getSelfOrderEnabled(ctx.restaurantId)
  const invoiceFooter = await getInvoiceFooterNote(ctx.restaurantId)

  const essentials: (string | null)[] = [
    profile.name,
    profile.legalName,
    profile.logoUrl,
    profile.addressLine1,
    profile.city,
    profile.phone,
    profile.fssaiLicense,
  ]
  if (taxProfile.gstRegistrationType !== "UNREGISTERED") {
    essentials.push(taxProfile.gstin)
  }
  const completeness = {
    done: essentials.filter(Boolean).length,
    total: essentials.length,
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Settings"
        description="Your restaurant profile, branding, and tax configuration."
      />
      <ProfileHeader profile={profile} completeness={completeness} />
      <UsernameCard username={profile.username} />
      <SelfOrderCard enabled={selfOrderEnabled} username={profile.username} />
      <InvoiceFooterCard note={invoiceFooter} />
      <RestaurantProfileForm profile={profile} />
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            A showcase gallery for your restaurant (up to 8).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GalleryManager gallery={profile.gallery} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Videos</CardTitle>
          <CardDescription>
            Add promo clips by link (YouTube / Instagram / Vimeo) or upload a
            file (up to 6).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideosManager videos={profile.videos} />
        </CardContent>
      </Card>
      <TaxSettingsForm profile={taxProfile} />
      <SignInPinCard status={pinStatus} />
    </div>
  )
}
