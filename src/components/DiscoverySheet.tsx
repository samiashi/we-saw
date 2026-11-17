import { useEffect, useMemo, useState } from "react";
import { fallbackTitle, fetchTitleDetails } from "@/lib/api";
import { buildTasteProfile, predictScore } from "@/lib/analytics";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import type { Title, TitleSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Backdrop } from "@/components/Backdrop";
import { Poster } from "@/components/Poster";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { WhereToWatch } from "@/components/WhereToWatch";

export function DiscoverySheet({
  summary,
  onClose,
  onLog,
}: {
  summary: TitleSummary;
  onClose: () => void;
  onLog: (summary: TitleSummary) => void;
}) {
  const { entries, people, nameFor, addToList } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(true);

  const profiles = useMemo(
    () => people.map((person) => buildTasteProfile(entries, person.id)),
    [entries, people],
  );
  const engineReady = profiles.some((profile) => profile.count >= 3);

  useEffect(() => {
    let active = true;

    void (async () => {
      const details = (await fetchTitleDetails(summary)) ?? fallbackTitle(summary);
      if (!active) return;
      setTitle(details);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [summary]);

  const predictions =
    title && engineReady
      ? profiles.map((profile) => ({
          personId: profile.personId,
          score: predictScore(profile, title).score,
        }))
      : null;
  const safe = predictions?.length
    ? Math.min(...predictions.map((prediction) => prediction.score))
    : null;
  const hasBackdrop = Boolean(title?.backdropPath);

  async function handleAdd() {
    if (!title) return;
    const result = await addToList(title);
    toast.show(
      result === "added"
        ? `Added ${title.name} to Up Next`
        : result === "exists"
          ? `${title.name} is already on the list`
          : `Could not add ${title.name} to Up Next`,
    );
  }

  return (
    <Drawer open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DrawerContent aria-label={title?.name ?? summary.name}>
        <header className="flex items-center justify-between">
          <span className="text-xs tracking-[0.08em] text-muted uppercase">Discover</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : title ? (
          <>
            <div className="relative -mx-4 -mt-4">
              {hasBackdrop ? (
                <div className="relative h-40 overflow-hidden rounded-t-[20px]">
                  <Backdrop title={title} className="h-full w-full" />
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface to-transparent" />
                </div>
              ) : null}
              <div
                className={cn(
                  "relative flex items-start gap-3.5 px-4",
                  hasBackdrop ? "-mt-20" : "pt-1",
                )}
              >
                <Poster
                  title={title}
                  className={cn(hasBackdrop && "shadow-lg ring-4 ring-surface")}
                />
                <div className="flex min-w-0 flex-col gap-1.5 pt-1">
                  <h2 className="text-[19px] leading-tight font-semibold">
                    {title.name}{" "}
                    {title.year ? <span className="text-muted">({title.year})</span> : null}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] text-muted uppercase">
                      {title.type === "movie" ? "Movie" : "TV"}
                    </span>
                    {title.genres.slice(0, 3).map((genre) => (
                      <span key={genre} className="text-muted">
                        {genre}
                      </span>
                    ))}
                  </div>
                  {predictions ? (
                    <div className="flex flex-wrap gap-1.5">
                      {predictions.map((prediction) => (
                        <span
                          key={prediction.personId}
                          className="inline-flex items-center rounded-full border border-[#78b4ff]/40 bg-[#78b4ff]/12 px-2.5 py-0.5 text-[11.5px] text-[#bfe3ff]"
                        >
                          {nameFor(prediction.personId)} {prediction.score}
                        </span>
                      ))}
                      {safe != null ? (
                        <span className="inline-flex items-center rounded-full border border-accent/45 bg-accent/12 px-2.5 py-0.5 text-[11.5px] text-[#f3d493]">
                          Safe {safe}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {title.overview ? (
              <p className="text-sm leading-relaxed text-ink/85">{title.overview}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onLog(summary)}>Log a watch</Button>
              <Button variant="outline" onClick={() => void handleAdd()}>
                Add to Up Next
              </Button>
            </div>

            <section className="flex flex-col gap-2.5">
              <span className="text-xs tracking-[0.07em] text-muted uppercase">Where to watch</span>
              <WhereToWatch type={title.type} tmdbId={title.tmdbId} />
            </section>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted">Could not load this title.</p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
