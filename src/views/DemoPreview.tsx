import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import {
  buildEntries,
  compatibility,
  divergences,
  formatMinutes,
  genreStats,
  jointEntries,
  makeScorer,
  scoreStats,
  seasonLabel,
  totalMinutes,
} from "@/lib/analytics";
import { buildDemoData } from "@/lib/demo";

const PIE_COLORS = ["#e8b64c", "#e0685c", "#57c785", "#a48cff", "#78b4ff", "#f3d493"];
const TOOLTIP_STYLE = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-ink)",
};

export function DemoPreview({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  const demo = useMemo(() => buildDemoData(), []);
  const entries = useMemo(
    () => buildEntries(Object.values(demo.titles), demo.watches, demo.ratings),
    [demo],
  );
  const joint = useMemo(() => jointEntries(entries), [entries]);
  const movies = entries.filter((entry) => entry.title.type === "movie").length;
  const seasons = entries.length - movies;
  const overall = scoreStats(entries, makeScorer());
  const genres = genreStats(entries, makeScorer(), 6);
  const pair = { a: demo.people[0], b: demo.people[1] };
  const compat = compatibility(joint, pair.a.id, pair.b.id);
  const gaps = divergences(joint, pair.a.id, pair.b.id);
  const top = [...entries]
    .filter((entry) => entry.combined != null)
    .sort((a, b) => (b.combined ?? 0) - (a.combined ?? 0))
    .slice(0, 5);

  return (
    <div className="bg-bg fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex max-w-[720px] flex-col gap-[18px] px-4 py-5 pb-28">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">A sample household</h1>
            <p className="text-muted mt-1 text-sm">
              Demo data only — nothing here is saved. Sign in to start your own log.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
          {[
            { value: String(movies), label: "Movies" },
            { value: String(seasons), label: "TV seasons" },
            { value: formatMinutes(totalMinutes(entries)), label: "Watch time" },
            { value: overall.avg?.toFixed(1) ?? "—", label: "Avg rating" },
          ].map((card) => (
            <div
              key={card.label}
              className="border-line bg-surface flex flex-col gap-1 rounded-2xl border p-3.5"
            >
              <span className="text-[22px] font-bold tracking-tight">{card.value}</span>
              <span className="text-muted text-xs">{card.label}</span>
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Taste match</h2>
            <span className="text-muted text-[13px]">
              {pair.a.name} & {pair.b.name} · {compat.sharedCount} joint ratings
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            <div className="border-line bg-surface flex flex-col gap-1 rounded-2xl border p-3.5">
              <span className="text-[22px] font-bold tracking-tight">{compat.avgGap}</span>
              <span className="text-muted text-xs">Avg gap</span>
            </div>
            <div className="border-line bg-surface flex flex-col gap-1 rounded-2xl border p-3.5">
              <span className="text-[22px] font-bold tracking-tight">{compat.closeShare}%</span>
              <span className="text-muted text-xs">Within 2 points</span>
            </div>
            {gaps.length ? (
              <div className="border-line bg-surface col-span-full col-start-1 flex flex-col gap-1 rounded-2xl border p-3.5">
                <span className="text-muted text-xs tracking-[0.07em] uppercase">
                  Biggest disagreement
                </span>
                <span className="text-[14px]">
                  {gaps[0].entry.title.name} — {pair.a.name} {gaps[0].scoreA}, {pair.b.name}{" "}
                  {gaps[0].scoreB}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Top genres</h2>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genres}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
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
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Top of the year</h2>
          <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
            {top.map((entry) => (
              <div key={entry.watch.id} className="flex justify-between gap-3 text-[13.5px]">
                <span className="truncate">
                  {entry.title.name} {seasonLabel(entry)}
                </span>
                <span className="text-accent whitespace-nowrap">{entry.combined}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
          <p className="text-sm">
            This is what a few weeks of logging looks like. Your own log starts empty and fills up
            the same way.
          </p>
          <Button className="w-full" onClick={onSignIn}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
