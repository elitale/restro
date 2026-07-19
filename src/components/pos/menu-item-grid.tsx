"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuDTO, MenuItemDTO } from "@/types/menu";

const DIET_DOT: Record<string, string> = {
  VEG: "bg-green-600",
  NON_VEG: "bg-red-600",
  EGG: "bg-amber-500",
};

function ItemTile({
  item,
  onTap,
}: {
  readonly item: MenuItemDTO;
  readonly onTap: (item: MenuItemDTO) => void;
}) {
  const photo = item.images.find((i) => i.isPrimary) ?? item.images[0] ?? null;
  return (
    <button
      type="button"
      disabled={!item.available}
      onClick={() => onTap(item)}
      className={cn(
        "relative flex h-28 flex-col justify-between overflow-hidden rounded-lg border p-3 text-left transition-colors",
        item.available
          ? "hover:border-primary hover:bg-accent"
          : "cursor-not-allowed opacity-60",
        photo && "text-white",
      )}
    >
      {photo ? (
        <>
          <Image
            src={photo.url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </>
      ) : null}
      <span className="relative flex items-start gap-1.5 text-sm font-medium">
        {item.dietaryType ? (
          <span
            className={cn(
              "mt-1 size-2 shrink-0 rounded-full ring-1 ring-white/40",
              DIET_DOT[item.dietaryType],
            )}
          />
        ) : null}
        <span className="line-clamp-2">{item.name}</span>
      </span>
      <span className="relative flex items-center justify-between">
        <span
          className={cn(
            "text-sm",
            photo ? "text-white/90" : "text-muted-foreground",
          )}
        >
          {formatCurrency(item.price)}
        </span>
        {!item.available ? (
          <Badge variant="secondary" className="text-[10px]">
            Unavailable
          </Badge>
        ) : null}
      </span>
    </button>
  );
}

export function MenuItemGrid({
  menu,
  onTapItem,
}: {
  readonly menu: MenuDTO;
  readonly onTapItem: (item: MenuItemDTO) => void;
}) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.categories
      .filter((c) => c.isActive)
      .map((category) => ({
        category,
        items: menu.items.filter(
          (i) =>
            i.isActive &&
            i.categoryId === category.id &&
            (q ? i.name.toLowerCase().includes(q) : true),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [menu.categories, menu.items, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the menu"
          className="h-10 pl-9"
          inputMode="search"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-sm">No items found.</p>
        ) : (
          sections.map(({ category, items }) => (
            <section key={category.id} className="flex flex-col gap-2">
              <h3 className="bg-background text-muted-foreground sticky top-0 z-10 py-1 text-sm font-medium">
                {category.name}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <ItemTile key={item.id} item={item} onTap={onTapItem} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
