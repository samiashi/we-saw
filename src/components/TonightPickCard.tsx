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
    <article className="border-line bg-surface-2/50 flex gap-3 rounded-2xl border p-3.5">
      <Poster title={title} variant="small" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div className="flex w-full items-start justify-between gap-2">
          <div>
            <p className="text-accent mb-1 text-xs font-medium">
              {index === 0 ? "First choice" : `Another option · ${index + 1}`}
            </p>
            <h3 className="text-base leading-snug font-semibold">{title.name}</h3>
            <p className="text-muted mt-1 text-xs">
              {title.type === "tv" ? "TV" : "Movie"}
              {title.year ? ` · ${title.year}` : ""}
              {title.runtimeMinutes
                ? ` · ${formatMinutes(title.runtimeMinutes)}${title.type === "tv" ? " / episode" : ""}`
                : " · Runtime unknown"}
            </p>
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
        <p className="text-ink/90 text-sm leading-relaxed">{pick.reason}</p>
        {evidence.length ? (
          <p className="text-muted text-xs">Based on your ratings of {evidence.join(" and ")}.</p>
        ) : null}
        {pick.caveat ? <p className="text-muted text-xs leading-relaxed">{pick.caveat}</p> : null}
        <Button variant="outline" size="sm" onClick={onOpen}>
          View title <ArrowUpRight size={14} />
        </Button>
      </div>
    </article>
  );
}
