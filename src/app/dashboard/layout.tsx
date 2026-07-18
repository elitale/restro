import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUserId } from "@/lib/auth-helpers"
import { getManagerById } from "@/services/user.service"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = await requireUserId()
  const user = await getManagerById(userId)

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
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
