import { notFound } from "next/navigation";

import { StaffLoginForm } from "@/components/staff-login/staff-login-form";
import {
  getStaffLoginRestaurant,
  listLoginStaff,
} from "@/services/staff-auth.service";

export default async function StaffLoginPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const restaurant = await getStaffLoginRestaurant(username);
  if (!restaurant) {
    notFound();
  }
  const staff = await listLoginStaff(restaurant.id);

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <StaffLoginForm
        username={restaurant.username}
        restaurantName={restaurant.name}
        logoUrl={restaurant.logoUrl}
        staff={staff}
      />
    </main>
  );
}
