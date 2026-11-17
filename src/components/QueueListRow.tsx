import { Play } from "lucide-react";
import { Poster } from "@/components/Poster";
import { Chip } from "@/components/ui/chip";
import { PredictionChips } from "@/components/PredictionChips";
import { NextEpisodeChip } from "@/components/NextEpisodeChip";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { titleToSummary } from "@/lib/api";
import type { Prediction } from "@/lib/analytics";
import type { ListItem, NextEpisode, Title, TitleSummary } from "@/lib/types";
const statusLabels = { watching: "Watching", queued: "Queued", dropped: "Dropped" };

export function QueueListRow({
  item,
  title,
  predictions,
  nextEpisode,
  onLog,
}: {
  item: ListItem;
  title: Title;
  predictions: Prediction[] | null;
  nextEpisode: NextEpisode | null;
  onLog: (summary: TitleSummary) => void;
}) {
  const { setListStatus, removeFromList, nameFor } = useStore();
  const toast = useToast();

  async function handleRemove() {
    const removed = await removeFromList(item.id);
    if (removed) toast.show(`Removed ${title.name} from Up Next`);
  }

  return (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-3">
      <Poster title={title} variant="small" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch">
        <span className="truncate text-[15px] font-semibold">
          {title.name}
          {title.year ? <span className="font-medium text-muted"> · {title.year}</span> : null}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] text-muted uppercase">
            {title.type === "movie" ? "Movie" : "TV"}
          </span>
          {item.addedBy ? (
            <span className="text-muted">Added by {nameFor(item.addedBy)}</span>
          ) : null}
          {title.genres.slice(0, 2).map((genre) => (
            <span key={genre} className="text-muted">
              {genre}
            </span>
          ))}
          <NextEpisodeChip episode={nextEpisode} />
        </div>
        {predictions ? <PredictionChips predictions={predictions} /> : null}
        <div className="mt-auto flex flex-wrap gap-1.5">
          {(["watching", "queued", "dropped"] as const).map((status) => (
            <Chip
              key={status}
              active={item.status === status}
              onClick={() => void setListStatus(item.id, status)}
            >
              {statusLabels[status]}
            </Chip>
          ))}
          <Chip onClick={() => onLog(titleToSummary(title))}>
            <Play size={12} /> Log watch
          </Chip>
          <Chip onClick={() => void handleRemove()}>Remove</Chip>
        </div>
      </div>
    </div>
  );
}
