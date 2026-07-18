"use server";

import { withManagerValidation } from "@/actions/helpers";
import {
  removeRecipeComponentSchema,
  setRecipeComponentSchema,
} from "@/lib/validators/inventory";
import {
  removeRecipeComponent,
  setRecipeComponent,
} from "@/services/recipe.service";

export const setRecipeComponentAction = withManagerValidation(
  setRecipeComponentSchema,
  (data, ctx) => setRecipeComponent(ctx, data),
);

export const removeRecipeComponentAction = withManagerValidation(
  removeRecipeComponentSchema,
  (data, ctx) => removeRecipeComponent(ctx, data),
);
