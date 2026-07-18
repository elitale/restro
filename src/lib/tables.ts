import type { TableDTO } from "@/types/table";

/** Group tables into `[section, tables]` buckets, preserving input order. */
export const groupTablesBySection = (
  tables: readonly TableDTO[],
): [string, TableDTO[]][] => {
  const groups = new Map<string, TableDTO[]>();
  for (const table of tables) {
    const key = table.section?.trim() || "No section";
    const rows = groups.get(key) ?? [];
    rows.push(table);
    groups.set(key, rows);
  }
  return [...groups.entries()];
};
