import {
  KITCHEN_STATUS_LABEL,
  deriveKitchenStatus,
  type KitchenStatus,
} from "@/lib/kitchen";

const STATUS_STYLE: Record<KitchenStatus, string> = {
  WAITING: "bg-amber-100 text-amber-900",
  PREPARING: "bg-sky-100 text-sky-900",
  READY: "bg-emerald-100 text-emerald-900",
};

/** Small kitchen-status pill derived from an order's line states. Renders
 *  nothing when no lines are live in the kitchen. */
export function KitchenStatusBadge({
  states,
  className,
}: {
  readonly states: readonly string[];
  readonly className?: string;
}) {
  const status = deriveKitchenStatus(states);
  if (!status) {
    return null;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}${className ? ` ${className}` : ""}`}
    >
      {KITCHEN_STATUS_LABEL[status]}
    </span>
  );
}
