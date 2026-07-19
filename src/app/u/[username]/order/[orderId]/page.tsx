import { redirect } from "next/navigation";

import { OrderBuilder } from "@/components/waiter/order-builder";
import { getStaffContextOrNull } from "@/lib/staff-auth";
import { getMenu } from "@/services/menu-item.service";
import { getOrder, listOrders } from "@/services/order.service";
import { getServiceOptions } from "@/services/restaurant-settings.service";
import { getStaffLoginRestaurant } from "@/services/staff-auth.service";
import { getTables } from "@/services/table.service";

export default async function AddToOrderPage({
  params,
}: {
  params: Promise<{ username: string; orderId: string }>;
}) {
  const { username, orderId } = await params;
  const ctx = await getStaffContextOrNull();
  if (!ctx || ctx.role !== "WAITER") {
    redirect(`/u/${username}/login`);
  }
  const restaurant = await getStaffLoginRestaurant(username);
  if (!restaurant || restaurant.id !== ctx.restaurantId) {
    redirect(`/u/${username}/login`);
  }

  const existingOrder = await getOrder(ctx.restaurantId, orderId).catch(
    () => null,
  );
  if (!existingOrder || existingOrder.status !== "OPEN") {
    redirect(`/u/${username}`);
  }

  const [menu, tables, services, openOrders] = await Promise.all([
    getMenu(ctx.restaurantId),
    getTables(ctx.restaurantId),
    getServiceOptions(ctx.restaurantId),
    listOrders(ctx.restaurantId, ["OPEN"]),
  ]);
  const occupied: Record<string, string> = Object.fromEntries(
    openOrders
      .filter((o) => o.tableId)
      .map((o) => [o.tableId as string, o.id]),
  );

  return (
    <OrderBuilder
      mode="add"
      username={restaurant.username}
      menu={menu}
      tables={tables}
      occupied={occupied}
      services={services}
      existingOrder={existingOrder}
    />
  );
}
