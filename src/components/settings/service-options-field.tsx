"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { OrderType } from "@/types/order";
import type { ServiceOptions } from "@/types/settings";

const ROWS: readonly {
  key: "dineIn" | "takeaway" | "delivery";
  type: OrderType;
  label: string;
  hint: string;
}[] = [
  { key: "dineIn", type: "DINE_IN", label: "Dine-in", hint: "Seat guests at tables" },
  {
    key: "takeaway",
    type: "TAKEAWAY",
    label: "Takeaway",
    hint: "Counter / pickup orders",
  },
  { key: "delivery", type: "DELIVERY", label: "Delivery", hint: "Send orders out" },
];

export function ServiceOptionsField({
  value,
  onChange,
}: {
  readonly value: ServiceOptions;
  readonly onChange: (value: ServiceOptions) => void;
}) {
  const setEnabled = (row: (typeof ROWS)[number], checked: boolean) => {
    const next: ServiceOptions = { ...value, [row.key]: checked };
    // If the current default just got disabled, move it to the first enabled one.
    if (!checked && value.defaultType === row.type) {
      const fallback = ROWS.find((r) => next[r.key]);
      onChange({ ...next, defaultType: fallback ? fallback.type : next.defaultType });
      return;
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => {
        const enabled = value[row.key];
        const isDefault = value.defaultType === row.type;
        return (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-muted-foreground text-xs">{row.hint}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onChange({ ...value, defaultType: row.type })}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-40",
                  isDefault
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:border-primary",
                )}
              >
                {isDefault ? "Default" : "Set default"}
              </button>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(row, checked)}
              />
            </div>
          </div>
        );
      })}
      <p className="text-muted-foreground text-xs">
        These control which order types appear in the POS — the default is
        pre-selected there.
      </p>
    </div>
  );
}

