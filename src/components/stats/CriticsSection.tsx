import { seasonLabel, type CriticGap, type CriticOutlier } from "@/lib/analytics";

export function CriticsSection({
  critics,
  outliers,
}: {
  critics: CriticGap[];
  outliers: CriticOutlier[];
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">You vs critics</h2>
        <span className="text-muted text-[13px]">10-point scale</span>
      </div>
      {critics.length ? (
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          {critics.map((row) => (
            <div key={row.source} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">{row.source}</span>
              <span className="text-muted whitespace-nowrap">
                This scope {row.userAvg} · Critics {row.criticAvg} ·{" "}
                <span className={row.delta >= 0 ? "text-good" : "text-bad"}>
                  {row.delta >= 0 ? "+" : ""}
                  {row.delta}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-[13px]">
          Critic scores fill in for movies once an OMDb key is configured.
        </p>
      )}
      {outliers.length ? (
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          <span className="text-muted text-xs tracking-[0.07em] uppercase">
            Biggest opinion gaps
          </span>
          {outliers.map((row) => (
            <div key={row.entry.watch.id} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">
                {row.entry.title.name} {seasonLabel(row.entry)}
              </span>
              <span className="text-muted whitespace-nowrap">
                You {row.user} · Critics {row.critic} ·{" "}
                <span className={row.delta >= 0 ? "text-good" : "text-bad"}>
                  {row.delta >= 0 ? "+" : ""}
                  {row.delta}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
