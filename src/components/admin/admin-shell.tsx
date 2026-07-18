import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";

export function AdminShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <AdminNav />
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
