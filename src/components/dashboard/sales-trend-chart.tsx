"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { DashboardTrendPoint } from "@/types/dashboard";

const config = {
  sales: { label: "Sales", color: "var(--primary)" },
} satisfies ChartConfig;

export function SalesTrendChart({
  data,
}: {
  readonly data: readonly DashboardTrendPoint[];
}) {
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart
        data={data as DashboardTrendPoint[]}
        margin={{ left: 4, right: 4, top: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `Day ${label}`}
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
