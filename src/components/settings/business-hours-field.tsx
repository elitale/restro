"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DAY_LABELS, DAY_ORDER } from "@/lib/business-hours";
import type { BusinessHoursDTO } from "@/types/settings";

export function BusinessHoursField({
  value,
  onChange,
}: {
  readonly value: readonly BusinessHoursDTO[];
  readonly onChange: (value: BusinessHoursDTO[]) => void;
}) {
  const update = (day: number, patch: Partial<BusinessHoursDTO>) =>
    onChange(value.map((h) => (h.day === day ? { ...h, ...patch } : h)));

  return (
    <div className="flex flex-col gap-2">
      {DAY_ORDER.map((day) => {
        const hours =
          value.find((h) => h.day === day) ??
          ({ day, isClosed: false, opensAt: "11:00", closesAt: "23:00" } as const);
        return (
          <div key={day} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm">{DAY_LABELS[day]}</span>
            <Switch
              checked={!hours.isClosed}
              onCheckedChange={(open) => update(day, { isClosed: !open })}
            />
            {hours.isClosed ? (
              <span className="text-muted-foreground text-sm">Closed</span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={hours.opensAt}
                  onChange={(e) => update(day, { opensAt: e.target.value })}
                  className="w-28"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={hours.closesAt}
                  onChange={(e) => update(day, { closesAt: e.target.value })}
                  className="w-28"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
