import {
  ImagesIcon,
  KeyRoundIcon,
  MapPinIcon,
  QrCodeIcon,
  ReceiptIcon,
  StoreIcon,
} from "lucide-react"

import { GalleryManager } from "@/components/settings/gallery-manager"
import { InvoiceFooterCard } from "@/components/settings/invoice-footer-card"
import { LocationMapCard } from "@/components/settings/location-map-card"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import {
  getInvoiceFooterNote,
  getRestaurantProfile,
  getSelfOrderEnabled,
  getTaxProfile,
} from "@/services/restaurant-settings.service"
import { getPinStatus } from "@/services/pin-auth.service"

const TABS = [
  { value: "profile", label: "Profile", icon: StoreIcon },
  { value: "location", label: "Location", icon: MapPinIcon },
  { value: "ordering", label: "Ordering", icon: QrCodeIcon },
  { value: "billing", label: "Billing & tax", icon: ReceiptIcon },
  { value: "media", label: "Media", icon: ImagesIcon },
  { value: "access", label: "Access", icon: KeyRoundIcon },
] as const

const NAV_TRIGGER =
  "h-auto w-full flex-none justify-start gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground data-active:bg-muted! data-active:text-foreground data-active:shadow-none!"

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

  const address =
    [
      profile.addressLine1,
      profile.addressLine2,
      profile.city,
      profile.state,
      profile.postalCode,
    ]
      .filter(Boolean)
      .join(", ") || null

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Settings"
        description="Your restaurant profile, branding, location and tax configuration."
      />
      <ProfileHeader profile={profile} completeness={completeness} />

      <Tabs
        defaultValue="profile"
        orientation="vertical"
        className="flex-col gap-6 lg:flex-row lg:items-start"
      >
        <TabsList className="h-fit w-full flex-col gap-1 rounded-xl border bg-card p-2 lg:w-60 lg:shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={NAV_TRIGGER}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="profile" keepMounted>
            <RestaurantProfileForm profile={profile} />
          </TabsContent>

          <TabsContent value="location" keepMounted>
            <LocationMapCard
              latitude={profile.latitude}
              longitude={profile.longitude}
              address={address}
            />
          </TabsContent>

          <TabsContent value="ordering" keepMounted>
            <SelfOrderCard
              enabled={selfOrderEnabled}
              username={profile.username}
            />
          </TabsContent>

          <TabsContent
            value="billing"
            keepMounted
            className="flex flex-col gap-6"
          >
            <TaxSettingsForm profile={taxProfile} />
            <InvoiceFooterCard note={invoiceFooter} />
          </TabsContent>

          <TabsContent
            value="media"
            keepMounted
            className="flex flex-col gap-6"
          >
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
                  Add promo clips by link (YouTube / Instagram / Vimeo) or
                  upload a file (up to 6).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideosManager videos={profile.videos} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="access"
            keepMounted
            className="flex flex-col gap-6"
          >
            <UsernameCard username={profile.username} />
            <SignInPinCard status={pinStatus} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

