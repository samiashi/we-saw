import { useMemo, useState } from "react";
import { Backdrop } from "@/components/Backdrop";
import { Poster } from "@/components/Poster";
import { RatingPicker } from "@/components/RatingPicker";
import { WatchCard } from "@/components/WatchCard";
import { formatWatchDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { WhereToWatch } from "@/components/WhereToWatch";
import { seasonLabel } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/useToast";
import type { Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

function groupLabel(monthKey: string): string {
  if (monthKey === "unknown") return "Date unknown";
  const date = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function WatchDetail({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { people, userId, nameFor, canEditScore, setRating, removeWatch } = useStore();
  const toast = useToast();
  const label = seasonLabel(entry);
  const critic = entry.title.critic;
  const watchers = entry.watch.watchers;
  const watcherPeople = people.filter((person) => watchers.includes(person.id));
  const hasBackdrop = Boolean(entry.title.backdropPath);

  async function handleDelete() {
    if (!window.confirm(`Delete this watch of ${entry.title.name}${label ? ` ${label}` : ""}?`))
      return;
    const removed = await removeWatch(entry.watch.id);
    onClose();
    if (removed) toast.show(`Deleted ${entry.title.name}${label ? ` ${label}` : ""}`);
  }

  async function handleRate(personId: string, score: number) {
    const saved = await setRating(entry.watch.id, personId, score);
    if (saved) {
      toast.show(
        personId === userId ? `Rated ${score}` : `Rated ${score} for ${nameFor(personId)}`,
      );
    }
  }

  return (
    <Drawer open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DrawerContent aria-label={`${entry.title.name} watch details`}>
        <header className="flex items-center justify-between">
          <span className="text-muted text-xs tracking-[0.08em] uppercase">
            {formatWatchDate(entry.watch.watchedOn)}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="relative -mx-4 -mt-4">
          {hasBackdrop ? (
            <div className="relative h-40 overflow-hidden rounded-t-[20px]">
              <Backdrop title={entry.title} className="h-full w-full" />
              <div className="from-surface absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t to-transparent" />
            </div>
          ) : null}
          <div
            className={cn(
              "relative flex items-start gap-3.5 px-4",
              hasBackdrop ? "-mt-20" : "pt-1",
            )}
          >
            <Poster
              title={entry.title}
              className={cn(hasBackdrop && "ring-surface shadow-lg ring-4")}
            />
            <div className="flex min-w-0 flex-col gap-1.5 pt-1">
              <h2 className="text-[19px] leading-tight font-semibold">
                {entry.title.name}
                {label ? <span className="text-muted font-medium"> · {label}</span> : null}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="border-line text-muted inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] uppercase">
                  {entry.title.type === "movie" ? "Movie" : "TV"}
                </span>
                {entry.title.year ? <span className="text-muted">{entry.title.year}</span> : null}
                {entry.title.genres.map((genre) => (
                  <span key={genre} className="text-muted">
                    {genre}
                  </span>
                ))}
              </div>
              {entry.title.directors.length ? (
                <p className="text-muted text-xs">Directed by {entry.title.directors.join(", ")}</p>
              ) : null}
              {entry.title.cast.length ? (
                <p className="text-muted text-xs">With {entry.title.cast.slice(0, 4).join(", ")}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {critic?.imdb != null ? (
                  <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                    IMDb {critic.imdb}
                  </span>
                ) : null}
                {critic?.rt != null ? (
                  <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                    RT {critic.rt}%
                  </span>
                ) : null}
                {critic?.metacritic != null ? (
                  <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                    MC {critic.metacritic}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {entry.title.overview ? (
          <p className="text-ink/85 text-sm leading-relaxed">{entry.title.overview}</p>
        ) : null}

        {entry.title.tmdbId ? (
          <section className="flex flex-col gap-2.5">
            <span className="text-muted text-xs tracking-[0.07em] uppercase">Where to watch</span>
            <WhereToWatch type={entry.title.type} tmdbId={entry.title.tmdbId} />
          </section>
        ) : null}

        {watcherPeople.map((person) => (
          <div key={person.id} className="flex flex-col gap-2">
            <span className="text-muted text-[13px]">
              {nameFor(person.id)}
              {entry.scores[person.id] == null && canEditScore(person.id, watchers)
                ? " — not rated yet"
                : ""}
            </span>
            <RatingPicker
              value={entry.scores[person.id] ?? null}
              onChange={(score) => void handleRate(person.id, score)}
              disabled={!canEditScore(person.id, watchers)}
              ariaLabel={`${nameFor(person.id)} rating`}
            />
          </div>
        ))}

        {entry.watch.note ? (
          <p className="text-muted text-sm italic">“{entry.watch.note}”</p>
        ) : null}

        <div className="flex justify-end">
          <Button variant="danger" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function HistoryView() {
  const { entries } = useStore();
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => entries.find((entry) => entry.watch.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.title.type === filter)),
    [entries, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of filtered) {
      const key = entry.watch.watchedOn?.slice(0, 7) ?? "unknown";
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return b.localeCompare(a);
    });
  }, [filtered]);

  return (
    <div className="flex flex-col gap-[18px]">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight">History</h1>
        <p className="text-muted mt-1 text-sm">{entries.length} watches logged</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", "movie", "tv"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "border-line text-muted rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              filter === option && "bg-surface-2 border-accent text-ink",
            )}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "All" : option === "movie" ? "Movies" : "TV"}
          </button>
        ))}
      </div>

      {groups.length ? (
        groups.map(([key, monthEntries]) => (
          <section key={key} className="cv-auto flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{groupLabel(key)}</h2>
              <span className="text-muted text-[13px]">{monthEntries.length} watched</span>
            </div>
            <div className="grid auto-rows-fr grid-cols-1 gap-2">
              {monthEntries.map((entry) => (
                <WatchCard
                  key={entry.watch.id}
                  entry={entry}
                  onOpen={(next) => setSelectedId(next.watch.id)}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="text-muted text-[13px]">Nothing here yet.</p>
      )}

      {selected ? <WatchDetail entry={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
