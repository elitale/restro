"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";

const DIET_DOT: Record<string, string> = {
  VEG: "bg-emerald-600",
  NON_VEG: "bg-red-600",
  EGG: "bg-amber-500",
};

export function MenuBrowser({
  menu,
  onQuickAdd,
  onOpenDetail,
}: {
  readonly menu: MenuDTO;
  readonly onQuickAdd: (item: MenuItemDTO) => void;
  readonly onOpenDetail: (item: MenuItemDTO) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = menu.categories.filter((c) => c.isActive);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.items
      .filter((i) => i.isActive)
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .filter((i) => (categoryId && !q ? i.categoryId === categoryId : true));
  }, [menu.items, query, categoryId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-background sticky top-0 z-10 flex flex-col gap-2 pb-2 pt-1">
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu"
            className="h-11 pl-9 text-base"
            inputMode="search"
          />
        </div>
        {query.trim() ? null : (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                categoryId === null ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  categoryId === c.id ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No items found.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const photo =
              item.images.find((i) => i.isPrimary) ?? item.images[0] ?? null;
            const hint = !item.available
              ? "Unavailable"
              : item.variants.length > 0 || item.modifierGroups.length > 0
                ? "Options"
                : null;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border p-2"
              >
                <button
                  type="button"
                  onClick={() => onOpenDetail(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {photo ? (
                    <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={photo.url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      {item.dietaryType ? (
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${DIET_DOT[item.dietaryType] ?? "bg-muted-foreground"}`}
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate font-medium">{item.name}</span>
                    </span>
                    {item.shortDescription ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.shortDescription}
                      </span>
                    ) : hint ? (
                      <span className="text-muted-foreground block text-xs">
                        {hint}
                      </span>
                    ) : null}
                    <span className="block text-sm font-medium tabular-nums">
                      ₹{item.price.toFixed(0)}
                    </span>
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  disabled={!item.available}
                  onClick={() => onQuickAdd(item)}
                  aria-label={`Add ${item.name}`}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
