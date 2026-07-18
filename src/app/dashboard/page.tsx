import { logoutAction } from "@/actions/auth.actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth-helpers";
import { getManagerById } from "@/services/user.service";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const user = await getManagerById(userId);

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title={user?.name ? `Welcome, ${user.name}` : "Welcome"}
          description="Your ElitaleRestro dashboard."
        />
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground text-sm">Signed in as</p>
        <p className="font-medium">{user?.phone ?? userId}</p>
      </div>
    </div>
  );
}
