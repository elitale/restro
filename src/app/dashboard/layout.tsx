import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUserId } from "@/lib/auth-helpers"
import { getManagerContextOrNull } from "@/lib/manager-auth"
import { getSelfOrderShareInfo } from "@/services/restaurant-settings.service"
import { getManagerById } from "@/services/user.service"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = await requireUserId()
  const [user, ctx] = await Promise.all([
    getManagerById(userId),
    getManagerContextOrNull(),
  ])
  const share = ctx ? await getSelfOrderShareInfo(ctx.restaurantId) : null

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={{
          name: user?.name ?? "Manager",
          contact: user?.phone ?? user?.email ?? "",
        }}
      />
      <SidebarInset>
        <SiteHeader staffLoginUsername={share?.username ?? null} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
