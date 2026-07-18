"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  UtensilsCrossedIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  BookOpenIcon,
  ArmchairIcon,
  BoxesIcon,
  Settings2Icon,
  CircleHelpIcon,
} from "lucide-react"

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "Orders", url: "#", icon: <ReceiptTextIcon /> },
  { title: "Menu", url: "/dashboard/menu", icon: <BookOpenIcon /> },
  { title: "Tables", url: "#", icon: <ArmchairIcon /> },
  { title: "Inventory", url: "#", icon: <BoxesIcon /> },
]

const navSecondary = [
  { title: "Settings", url: "/dashboard/settings", icon: <Settings2Icon /> },
  { title: "Get Help", url: "#", icon: <CircleHelpIcon /> },
]
export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; contact: string }
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <UtensilsCrossedIcon className="size-5!" />
              <span className="text-base font-semibold">ElitaleRestro</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
