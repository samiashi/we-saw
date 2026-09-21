import { seasonLabel, type Compatibility, type Divergence } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import type { Person } from "@/lib/types";
import { StatCard } from "@/components/StatCard";

export function TasteMatchSection({
  compat,
  gaps,
  pair,
}: {
  compat: Compatibility;
  gaps: Divergence[];
  pair: { a: Person; b: Person };
}) {
  const { nameFor } = useStore();
  const mostDivisive = gaps.slice(0, 3);
  const mostInSync = gaps.slice(-3).reverse();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Taste match</h2>
        <span className="text-muted text-[13px]">On joint watches</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <StatCard value={compat.avgGap} label="Avg gap" format={(value) => value.toFixed(1)} />
        <StatCard
          value={compat.closeShare}
          label="Within 2 points"
          format={(value) => `${Math.round(value)}%`}
        />
        <StatCard
          value={compat.correlation}
          label="Correlation"
          format={(value) => value.toFixed(2)}
        />
      </div>
      {mostDivisive.length ? (
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          <span className="text-muted text-xs tracking-[0.07em] uppercase">
            Biggest disagreements
          </span>
          {mostDivisive.map((row) => (
            <div key={row.entry.watch.id} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">
                {row.entry.title.name} {seasonLabel(row.entry)}
              </span>
              <span className="text-muted whitespace-nowrap">
                {nameFor(pair.a.id)} {row.scoreA} · {nameFor(pair.b.id)} {row.scoreB}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {mostInSync.length ? (
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          <span className="text-muted text-xs tracking-[0.07em] uppercase">Most in sync</span>
          {mostInSync.map((row) => (
            <div key={row.entry.watch.id} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">
                {row.entry.title.name} {seasonLabel(row.entry)}
              </span>
              <span className="text-muted whitespace-nowrap">
                {row.scoreA} & {row.scoreB}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
