import type { NextEpisode } from "@/lib/types";

export function NextEpisodeChip({ episode }: { episode: NextEpisode | null | undefined }) {
  if (!episode?.airDate || episode.seasonNumber == null || episode.episodeNumber == null)
    return null;
  const date = new Date(`${episode.airDate}T00:00:00`);
  const label = Number.isNaN(date.getTime())
    ? episode.airDate
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <span className="inline-flex items-center rounded-full border border-[#57c785]/40 bg-[#57c785]/10 px-2.5 py-0.5 text-[11.5px] whitespace-nowrap text-[#a7e8c0]">
      Next S{episode.seasonNumber}E{episode.episodeNumber} · {label}
    </span>
  );
}
