"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupTablesBySection } from "@/lib/tables";
import type { TableDTO } from "@/types/table";

export function TablePicker({
  tables,
  occupied,
  selectedId,
  onSelect,
}: {
  readonly tables: readonly TableDTO[];
  readonly occupied: Record<string, string>;
  readonly selectedId: string | null;
  readonly onSelect: (table: TableDTO) => void;
}) {
  return (
    <div className="flex max-h-56 flex-col gap-3 overflow-y-auto">
      {groupTablesBySection(tables).map(([section, rows]) => (
        <div key={section} className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{section}</span>
          <div className="flex flex-wrap gap-1.5">
            {rows.map((table) => {
              const isOccupied = Boolean(occupied[table.id]);
              const selected = table.id === selectedId;
              return (
                <Button
                  key={table.id}
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  onClick={() => onSelect(table)}
                >
                  {table.label}
                  {isOccupied ? (
                    <span
                      className={cn(
                        "ml-1.5 size-2 rounded-full",
                        selected ? "bg-background" : "bg-amber-500",
                      )}
                    />
                  ) : null}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
