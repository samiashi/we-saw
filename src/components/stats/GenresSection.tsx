import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PIE_COLORS, TOOLTIP_STYLE } from "@/components/stats/chart";
import type { StatRow } from "@/lib/analytics";

export function GenresSection({ genres }: { genres: StatRow[] }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[17px] font-semibold">Top genres</h2>
      {genres.length ? (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genres}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                  animationDuration={450}
                >
                  {genres.map((row, index) => (
                    <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {genres.map((row, index) => (
              <span key={row.name} className="inline-flex items-center gap-1.5 text-[13px]">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                {row.name}
                <span className="text-muted">
                  {row.count}
                  {row.avg != null ? ` · ${row.avg}` : ""}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted text-[13px]">Not enough data yet.</p>
      )}
    </section>
  );
}
