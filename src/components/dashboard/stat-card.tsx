import type { ReactNode } from "react";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StatCard({
  label,
  value,
  footer,
}: {
  readonly label: string;
  readonly value: string;
  readonly footer?: ReactNode;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      {footer ? <CardFooter className="text-sm">{footer}</CardFooter> : null}
    </Card>
  );
}

/** A "▲ 12% vs yesterday" style delta, or a muted label when there's no baseline. */
export function Delta({
  pct,
  label,
}: {
  readonly pct: number | null;
  readonly label: string;
}) {
  if (pct === null) {
    return <span className="text-muted-foreground">{label}</span>;
  }
  const up = pct >= 0;
  return (
    <span className={up ? "text-emerald-700" : "text-red-700"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% {label}
    </span>
  );
}
