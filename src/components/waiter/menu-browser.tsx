"use client";

import { useMemo, useState } from "react";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";

const DIET_DOT: Record<string, string> = {
  VEG: "bg-emerald-600",
  NON_VEG: "bg-red-600",
  EGG: "bg-amber-500",
};

export function MenuBrowser({
  menu,
  onTapItem,
}: {
  readonly menu: MenuDTO;
  readonly onTapItem: (item: MenuItemDTO) => void;
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
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!item.available}
                onClick={() => onTapItem(item)}
                className="hover:bg-accent flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {item.dietaryType ? (
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${DIET_DOT[item.dietaryType] ?? "bg-muted-foreground"}`}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    {!item.available ? (
                      <span className="text-muted-foreground text-xs">
                        Unavailable
                      </span>
                    ) : item.variants.length > 0 ||
                      item.modifierGroups.length > 0 ? (
                      <span className="text-muted-foreground text-xs">
                        Options
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  ₹{item.price.toFixed(0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
