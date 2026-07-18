import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/orders/order-detail";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getMenu } from "@/services/menu-item.service";
import { getOrder } from "@/services/order.service";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const order = await getOrder(ctx.restaurantId, id).catch(() => null);
  if (!order) {
    notFound();
  }
  const menu = await getMenu(ctx.restaurantId);

  return <OrderDetail order={order} menu={menu} />;
}
