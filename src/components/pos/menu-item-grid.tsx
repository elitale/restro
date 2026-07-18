"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";

const DIET_DOT: Record<string, string> = {
  VEG: "bg-green-600",
  NON_VEG: "bg-red-600",
  EGG: "bg-amber-500",
};

export function MenuItemGrid({
  menu,
  onTapItem,
}: {
  readonly menu: MenuDTO;
  readonly onTapItem: (item: MenuItemDTO) => void;
}) {
  const categories = menu.categories.filter((c) => c.isActive);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const visibleItems = menu.items.filter(
    (i) => i.isActive && i.categoryId === activeCategoryId,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={c.id === activeCategoryId ? "default" : "outline"}
            onClick={() => setActiveCategoryId(c.id)}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.available}
            onClick={() => onTapItem(item)}
            className={cn(
              "flex h-24 flex-col justify-between rounded-lg border p-3 text-left transition-colors",
              item.available
                ? "hover:border-primary hover:bg-accent"
                : "cursor-not-allowed opacity-60",
            )}
          >
            <span className="flex items-start gap-1.5 text-sm font-medium">
              {item.dietaryType ? (
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    DIET_DOT[item.dietaryType],
                  )}
                />
              ) : null}
              <span className="line-clamp-2">{item.name}</span>
            </span>
            <span className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {formatCurrency(item.price)}
              </span>
              {!item.available ? (
                <Badge variant="secondary" className="text-[10px]">
                  Unavailable
                </Badge>
              ) : null}
            </span>
          </button>
        ))}
        {visibleItems.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-sm">
            No items in this category yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
