import { applyMovements, type MovementInput } from "@/repositories/stock.repository";
import { getRecipesMap } from "@/services/recipe.service";

export interface DepletionContext {
  readonly restaurantId: string;
  readonly userId: string | null;
}

export interface OrderedLine {
  readonly menuItemId: string | null;
  readonly quantity: number;
}

/** Aggregate recipe consumption per stock item and apply signed movements. */
const applyConsumption = async (
  ctx: DepletionContext,
  lines: readonly OrderedLine[],
  orderId: string,
  sign: 1 | -1,
): Promise<void> => {
  const menuItemIds = lines
    .map((l) => l.menuItemId)
    .filter((id): id is string => Boolean(id));
  if (menuItemIds.length === 0) {
    return;
  }
  const recipes = await getRecipesMap(menuItemIds);
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.menuItemId) {
      continue;
    }
    for (const component of recipes.get(line.menuItemId) ?? []) {
      totals.set(
        component.stockItemId,
        (totals.get(component.stockItemId) ?? 0) +
          component.quantity * line.quantity,
      );
    }
  }
  if (totals.size === 0) {
    return;
  }
  const inputs: MovementInput[] = [...totals.entries()].map(
    ([stockItemId, quantity]) => ({
      restaurantId: ctx.restaurantId,
      stockItemId,
      type: "SALE_DEPLETION",
      delta: sign * quantity,
      reason: null,
      note: null,
      orderId,
      createdById: ctx.userId,
    }),
  );
  await applyMovements(inputs);
};

/** Deduct ingredients when an order's lines are placed. Allows negative on-hand. */
export const depleteForLines = (
  ctx: DepletionContext,
  lines: readonly OrderedLine[],
  orderId: string,
): Promise<void> => applyConsumption(ctx, lines, orderId, -1);

/** Restore ingredients when lines are voided. */
export const restoreForLines = (
  ctx: DepletionContext,
  lines: readonly OrderedLine[],
  orderId: string,
): Promise<void> => applyConsumption(ctx, lines, orderId, 1);
