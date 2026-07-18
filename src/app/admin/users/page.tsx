import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/shared/page-header";
import { serializeForClient } from "@/lib/utils";
import { userListQuerySchema } from "@/lib/validators/admin";
import { listUsers } from "@/services/admin-user.service";

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = userListQuerySchema.parse({
    search: typeof sp.search === "string" ? sp.search : undefined,
    role: typeof sp.role === "string" ? sp.role : undefined,
    page: typeof sp.page === "string" ? sp.page : undefined,
  });
  const result = await listUsers(query);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Every manager and admin on the platform."
      />
      <UsersTable data={serializeForClient(result)} />
    </div>
  );
}
