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
        <span className="text-[13px] text-muted">10-point scale</span>
      </div>
      {critics.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5">
          {critics.map((row) => (
            <div key={row.source} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">{row.source}</span>
              <span className="whitespace-nowrap text-muted">
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
        <p className="text-[13px] text-muted">
          Critic scores fill in for movies once an OMDb key is configured.
        </p>
      )}
      {outliers.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5">
          <span className="text-xs tracking-[0.07em] text-muted uppercase">
            Biggest opinion gaps
          </span>
          {outliers.map((row) => (
            <div key={row.entry.watch.id} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">
                {row.entry.title.name} {seasonLabel(row.entry)}
              </span>
              <span className="whitespace-nowrap text-muted">
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
