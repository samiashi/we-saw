import type { ReactNode } from "react";
import { safeSummaryScore, type TasteProfile } from "@/lib/analytics";
import type { TitleSummary } from "@/lib/types";
import { Poster } from "@/components/Poster";
import { cn } from "@/lib/utils";

export function DiscoveryRow({
  title,
  items,
  profiles,
  onOpen,
  headerRight,
}: {
  title: string;
  items: TitleSummary[];
  profiles: TasteProfile[];
  onOpen: (summary: TitleSummary) => void;
  headerRight?: ReactNode;
}) {
  if (!items.length) return null;
  const engineReady = profiles.some((profile) => profile.count >= 3);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {headerRight}
      </div>
      <div className="-mx-4 flex items-stretch gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const safe = engineReady ? safeSummaryScore(profiles, item) : null;
          return (
            <button
              key={item.key}
              type="button"
              className="flex w-[104px] shrink-0 flex-col gap-1.5 text-left"
              onClick={() => onOpen(item)}
            >
              <Poster title={item} className="w-full" />
              <span className="line-clamp-2 min-h-[33px] text-xs leading-snug">{item.name}</span>
              <span className="mt-auto flex flex-wrap gap-1">
                {safe != null ? (
                  <span className="border-accent/45 bg-accent/12 inline-flex rounded-full border px-2 py-0.5 text-[11px] text-[#f3d493]">
                    Safe {safe}
                  </span>
                ) : null}
                {item.voteAverage != null ? (
                  <span
                    className={cn(
                      "border-line text-muted inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                    )}
                  >
                    TMDB {item.voteAverage}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
