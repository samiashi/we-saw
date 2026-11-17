import { Poster } from "@/components/Poster";
import { ScoreChip } from "@/components/ScoreChip";
import { formatWatchDate } from "@/lib/dates";
import type { TasteInsight } from "@/lib/types";

export function TasteInsightCard({
  insight,
  nameFor,
}: {
  insight: TasteInsight;
  nameFor: (id: string) => string;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-base font-semibold">{insight.title}</h3>
      <p className="text-sm leading-relaxed text-ink/90">{insight.explanation}</p>
      <ul className="flex flex-col gap-2 text-xs text-muted">
        {insight.metrics.map((metric) => (
          <li key={metric.id}>
            <span className="font-medium text-ink">
              {nameFor(metric.viewerId)} · {metric.name}
            </span>
            {" — "}
            {metric.meanRating}/10 across {metric.count} rated watches
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer rounded text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          See supporting watches
        </summary>
        <ul className="mt-3 flex flex-col gap-3">
          {insight.evidence.map((watch) => (
            <li key={watch.id} className="flex items-start gap-3">
              <Poster
                title={{ name: watch.name, posterPath: watch.posterPath }}
                variant="small"
                className="h-[66px] self-start"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium break-words">{watch.name}</span>
                <span className="text-xs text-muted">{formatWatchDate(watch.watchedOn)}</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(watch.ratings).map(([id, score]) => (
                    <ScoreChip key={id} label={nameFor(id)} score={score} />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
