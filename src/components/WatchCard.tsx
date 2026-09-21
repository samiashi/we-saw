import { seasonLabel } from "@/lib/analytics";
import { formatWatchDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Entry } from "@/lib/types";
import { Poster } from "@/components/Poster";
import { ScoreChip } from "@/components/ScoreChip";

export function WatchCard({ entry, onOpen }: { entry: Entry; onOpen?: (entry: Entry) => void }) {
  const { nameFor } = useStore();
  const label = seasonLabel(entry);
  const critic = entry.title.critic;
  const watchers = entry.watch.watchers;

  return (
    <button
      type="button"
      className="border-line bg-surface hover:border-line/80 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors"
      onClick={() => onOpen?.(entry)}
    >
      <Poster title={entry.title} variant="small" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">
            {entry.title.name}
            {label ? <span className="text-muted font-medium"> · {label}</span> : null}
          </span>
          <span className="text-muted text-xs whitespace-nowrap">
            {formatWatchDate(entry.watch.watchedOn)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="border-line text-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] uppercase">
            {entry.title.type === "movie" ? "Movie" : "TV"}
          </span>
          {watchers.length === 1 ? (
            <span className="inline-flex items-center rounded-full border border-[#a48cff]/40 bg-[#a48cff]/12 px-2.5 py-0.5 text-[11.5px] whitespace-nowrap text-[#cfc0ff]">
              {nameFor(watchers[0])} solo
            </span>
          ) : null}
          {entry.title.year ? <span className="text-muted">{entry.title.year}</span> : null}
          {entry.title.genres.slice(0, 2).map((genre) => (
            <span key={genre} className="text-muted">
              {genre}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {watchers.map((watcherId) => (
            <ScoreChip key={watcherId} score={entry.scores[watcherId]} label={nameFor(watcherId)} />
          ))}
          {watchers.length > 1 ? <ScoreChip score={entry.combined} label="Avg" /> : null}
          {critic?.imdb != null ? (
            <span className="border-accent/35 bg-accent/8 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
              IMDb {critic.imdb}
            </span>
          ) : null}
          {critic?.rt != null ? (
            <span className="border-accent/35 bg-accent/8 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
              RT {critic.rt}%
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
