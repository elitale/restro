import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  // Defense in depth: the edge proxy blocks unauthenticated requests, and this
  // DB-backed role check keeps /admin locked to admins only.
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
