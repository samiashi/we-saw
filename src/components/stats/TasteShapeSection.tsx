import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { SERIES_COLORS, TOOLTIP_STYLE } from "@/components/stats/chart";
import { useStore } from "@/lib/store";

export function TasteShapeSection({
  data,
  personIds,
}: {
  data: Record<string, string | number>[];
  personIds: string[];
}) {
  const { nameFor } = useStore();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Taste shape</h2>
        <span className="text-muted text-[13px]">Smoothed affinity, 1–10</span>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--color-line)" />
            <PolarAngleAxis dataKey="genre" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
            {personIds.map((personId, index) => (
              <Radar
                key={personId}
                name={nameFor(personId)}
                dataKey={nameFor(personId)}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                fillOpacity={0.22}
                isAnimationActive={false}
              />
            ))}
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
