import { redirect } from "next/navigation";

import { KitchenDisplay } from "@/components/kitchen/kitchen-display";
import { WaiterHome } from "@/components/waiter/waiter-home";
import { getStaffContextOrNull } from "@/lib/staff-auth";
import { listKitchenTickets } from "@/services/kitchen.service";
import { listOrders } from "@/services/order.service";
import { getStaffLoginRestaurant } from "@/services/staff-auth.service";

export default async function StaffHomePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const ctx = await getStaffContextOrNull();
  if (!ctx) {
    redirect(`/u/${username}/login`);
  }

  // The URL's restaurant must match the signed-in staff's restaurant.
  const restaurant = await getStaffLoginRestaurant(username);
  if (!restaurant || restaurant.id !== ctx.restaurantId) {
    redirect(`/u/${username}/login`);
  }

  if (ctx.role === "WAITER") {
    const openOrders = await listOrders(ctx.restaurantId, ["OPEN"]);
    return (
      <main className="min-h-svh">
        <WaiterHome
          username={restaurant.username}
          restaurantName={restaurant.name}
          staffName={ctx.name}
          openOrders={openOrders}
        />
      </main>
    );
  }

  return (
    <main className="min-h-svh">
      <KitchenDisplay
        username={restaurant.username}
        restaurantName={restaurant.name}
        staffName={ctx.name}
        tickets={await listKitchenTickets(ctx.restaurantId)}
      />
    </main>
  );
}
