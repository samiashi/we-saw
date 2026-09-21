import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { TOOLTIP_STYLE, type TrendRow } from "@/components/stats/chart";
import { FilterChip } from "@/components/stats/FilterChip";

export type TrendMetric = "count" | "minutes" | "compare";

export function TrendSection({
  trend,
  compareData,
  metric,
  onMetric,
  yearFilter,
}: {
  trend: TrendRow[];
  compareData: TrendRow[];
  metric: TrendMetric;
  onMetric: (metric: TrendMetric) => void;
  yearFilter: string;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">
          {yearFilter === "all" ? "Last 12 months" : yearFilter}
        </h2>
        <div className="flex gap-1.5">
          {(["count", "minutes", "compare"] as const).map((option) => (
            <FilterChip
              key={option}
              small
              active={metric === option}
              onClick={() => onMetric(option)}
            >
              {option === "count" ? "Watches" : option === "minutes" ? "Hours" : "Compare"}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metric === "compare" ? compareData : trend}>
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            {metric === "count" ? (
              <Bar
                dataKey="count"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
                animationDuration={450}
              />
            ) : metric === "minutes" ? (
              <>
                <Bar
                  dataKey="movie"
                  stackId="time"
                  fill="var(--color-accent)"
                  animationDuration={450}
                />
                <Bar
                  dataKey="tv"
                  stackId="time"
                  fill="#a48cff"
                  radius={[4, 4, 0, 0]}
                  animationDuration={450}
                />
              </>
            ) : (
              <>
                <Bar
                  dataKey="joint"
                  stackId="who"
                  fill="var(--color-accent)"
                  animationDuration={450}
                />
                <Bar dataKey="a" stackId="who" fill="#a48cff" animationDuration={450} />
                <Bar
                  dataKey="b"
                  stackId="who"
                  fill="#57c785"
                  radius={[4, 4, 0, 0]}
                  animationDuration={450}
                />
              </>
            )}
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-surface-2)" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
