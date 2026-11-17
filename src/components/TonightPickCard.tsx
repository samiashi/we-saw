import { ArrowUpRight, X } from "lucide-react";
import { Poster } from "@/components/Poster";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/analytics";
import type { Title, TonightPick } from "@/lib/types";

export function TonightPickCard({
  title,
  pick,
  index,
  evidence,
  onOpen,
  onSkip,
}: {
  title: Title;
  pick: TonightPick;
  index: number;
  evidence: string[];
  onOpen: () => void;
  onSkip: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/50 p-3.5">
      <div className="flex items-start gap-3">
        <Poster title={title} className="h-30 w-20 self-start sm:h-36 sm:w-24" />
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0 break-words">
            <p className="mb-1 text-xs font-medium text-accent">
              {index === 0 ? "First choice" : `Another option · ${index + 1}`}
            </p>
            <h3 className="text-base leading-snug font-semibold">{title.name}</h3>
            <p className="mt-1 text-xs text-muted">
              {title.type === "tv" ? "TV" : "Movie"}
              {title.year ? ` · ${title.year}` : ""}
              {title.runtimeMinutes
                ? ` · ${formatMinutes(title.runtimeMinutes)}${title.type === "tv" ? " / episode" : ""}`
                : " · Runtime unknown"}
            </p>
            <div className="mt-2">
              {title.voteAverage != null && title.voteAverage > 0 ? (
                <span className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-xs text-ink">
                  TMDB {title.voteAverage}/10
                </span>
              ) : (
                <span className="text-xs text-muted">TMDB rating unavailable</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Not tonight: ${title.name}`}
            title="Skip for this session"
            onClick={onSkip}
          >
            <X size={16} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm leading-relaxed text-ink/90">{pick.reason}</p>
        {evidence.length ? (
          <p className="text-xs text-muted">Based on your ratings of {evidence.join(" and ")}.</p>
        ) : null}
        {pick.caveat ? <p className="text-xs leading-relaxed text-muted">{pick.caveat}</p> : null}
        <Button variant="outline" size="sm" onClick={onOpen}>
          View title <ArrowUpRight size={14} />
        </Button>
      </div>
    </article>
  );
}
