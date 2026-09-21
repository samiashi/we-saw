import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { StatCard } from "@/components/StatCard";
import { TOOLTIP_STYLE } from "@/components/stats/chart";
import type { Entry } from "@/lib/types";

export function ActivitySection({
  entries,
  streaks,
  weekdays,
}: {
  entries: Entry[];
  streaks: { current: number; longest: number };
  weekdays: { day: string; count: number }[];
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Activity</h2>
        <span className="text-muted text-[13px]">Last 53 weeks</span>
      </div>
      <ActivityHeatmap entries={entries} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <StatCard value={streaks.current} label="Week streak" />
        <StatCard value={streaks.longest} label="Longest streak" />
      </div>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekdays}>
            <XAxis
              dataKey="day"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="count"
              fill="var(--color-accent)"
              radius={[4, 4, 0, 0]}
              animationDuration={450}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-surface-2)" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
