"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  StoreIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { title: "Overview", href: "/admin", icon: LayoutDashboardIcon },
  { title: "Users", href: "/admin/users", icon: UsersIcon },
  { title: "Restaurants", href: "/admin/restaurants", icon: StoreIcon },
] as const;

const isActive = (pathname: string, href: string): boolean =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex w-60 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <UtensilsCrossedIcon className="text-primary size-5" aria-hidden />
        <span className="font-semibold">ElitaleRestro</span>
        <span className="text-muted-foreground text-xs font-medium">Admin</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(pathname, item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
