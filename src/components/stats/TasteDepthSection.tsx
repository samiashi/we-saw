import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { TOOLTIP_STYLE } from "@/components/stats/chart";
import type { LanguageStat, RewatchStats, RuntimePoint } from "@/lib/analytics";

export function TasteDepthSection({
  languages,
  rewatches,
  eraStats,
  runtimeData,
  missingCount,
  enriching,
  progress,
  onEnrich,
}: {
  languages: { rows: LanguageStat[]; unknown: number; foreignShare: number | null };
  rewatches: RewatchStats;
  eraStats: { decade: string; count: number; avg: number | null }[];
  runtimeData: RuntimePoint[];
  missingCount: number;
  enriching: boolean;
  progress: number;
  onEnrich: () => void;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Taste depth</h2>
        {missingCount ? (
          <Button variant="ghost" size="sm" onClick={onEnrich} disabled={enriching}>
            {enriching
              ? `Fetching ${progress}/${Math.min(missingCount, 40)}…`
              : `Fetch ${missingCount} languages`}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          <span className="text-muted text-xs tracking-[0.07em] uppercase">Where it's from</span>
          {languages.foreignShare != null ? (
            <>
              <span className="text-[22px] font-bold tracking-tight">
                {Math.round(languages.foreignShare)}%{" "}
                <span className="text-muted text-xs font-normal">non-English</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {languages.rows.slice(0, 5).map((row) => (
                  <span
                    key={row.language}
                    className="border-line text-muted inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] uppercase"
                  >
                    {row.language} · {row.count}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted text-[13px]">
              No language data yet{languages.unknown ? ` (${languages.unknown} titles)` : ""}.
            </p>
          )}
        </div>
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          <span className="text-muted text-xs tracking-[0.07em] uppercase">Comfort rewatches</span>
          {rewatches.comfort.length ? (
            <>
              <span className="text-[22px] font-bold tracking-tight">
                {rewatches.rate}%{" "}
                <span className="text-muted text-xs font-normal">of titles rewatched</span>
              </span>
              {rewatches.comfort.map((row) => (
                <span key={row.name} className="text-[13px]">
                  {row.name}{" "}
                  <span className="text-muted">
                    ×{row.count}
                    {row.avg != null ? ` · ${row.avg}` : ""}
                  </span>
                </span>
              ))}
            </>
          ) : (
            <p className="text-muted text-[13px]">Nothing rewatched yet.</p>
          )}
        </div>
      </div>
      {eraStats.length ? (
        <div className="h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={eraStats}>
              <XAxis
                dataKey="decade"
                tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 10]} hide />
              <Bar
                dataKey="avg"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
                animationDuration={450}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-surface-2)" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {runtimeData.length >= 4 ? (
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <XAxis
                type="number"
                dataKey="runtime"
                name="Minutes"
                tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis type="number" dataKey="score" domain={[1, 10]} hide />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const point = payload?.[0]?.payload as
                    { name?: string; runtime?: number; score?: number } | undefined;
                  if (!point) return null;
                  return (
                    <div className="bg-surface-2 border-line rounded-xl border px-3 py-2 text-xs">
                      {point.name} · {point.runtime}m · {point.score}
                    </div>
                  );
                }}
              />
              <Scatter data={runtimeData} fill="var(--color-accent)" isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <p className="text-muted text-[12.5px]">
        Era = average rating by release decade. Scatter = movie runtime against rating.
      </p>
    </section>
  );
}
