import { useEffect, useState } from "react";
import { fallbackTitle, fetchCriticScores, fetchTitleDetails } from "@/lib/api";
import { formatMinutes } from "@/lib/analytics";
import { localDateString } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Title, TitleSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Backdrop } from "@/components/Backdrop";
import { Poster } from "@/components/Poster";
import { RatingPicker } from "@/components/RatingPicker";
import { ScoreChip } from "@/components/ScoreChip";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function LogSheet({
  summary,
  onClose,
  onSaved,
}: {
  summary: TitleSummary;
  onClose: () => void;
  onSaved: (title: Title) => void;
}) {
  const { people, userId, mode, canEditScore, logWatch, nameFor, entries } = useStore();
  const [title, setTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [date, setDate] = useState(localDateString());
  const [note, setNote] = useState("");
  const [watchMode, setWatchMode] = useState("together");
  const [pickedBy, setPickedBy] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      let details = (await fetchTitleDetails(summary)) ?? fallbackTitle(summary);
      if (details.imdbId && !details.critic) {
        const critic = await fetchCriticScores(details.imdbId);
        if (critic) details = { ...details, critic };
      }
      if (!active) return;
      setTitle(details);
      if (details.type === "tv") setSeasonNumber(details.seasons[0]?.seasonNumber ?? 1);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [summary]);

  const watchOptions: { id: string; label: string; watchers: string[] }[] = [
    { id: "together", label: "Together", watchers: people.map((person) => person.id) },
  ];
  if (mode === "cloud" && userId) {
    watchOptions.push({
      id: `solo:${userId}`,
      label: `Just ${nameFor(userId)}`,
      watchers: [userId],
    });
  } else {
    for (const person of people) {
      watchOptions.push({
        id: `solo:${person.id}`,
        label: `Just ${nameFor(person.id)}`,
        watchers: [person.id],
      });
    }
  }
  const selectedOption = watchOptions.find((option) => option.id === watchMode) ?? watchOptions[0];
  const watchers = selectedOption.watchers;
  const watcherPeople = people.filter((person) => watchers.includes(person.id));
  const editable = watcherPeople.filter((person) => canEditScore(person.id, watchers));

  const season = title?.seasons.find((item) => item.seasonNumber === seasonNumber) ?? null;
  const recentTvWatches = entries.filter((entry) => entry.title.type === "tv").length;
  const seasonEstimate =
    title?.type === "tv" && title.runtimeMinutes != null && season
      ? title.runtimeMinutes * season.episodeCount
      : title?.type === "tv"
        ? title?.runtimeMinutes
        : null;
  const canSave =
    !loading &&
    !saving &&
    Boolean(title) &&
    editable.every((person) => scores[person.id] != null) &&
    (title?.type === "movie" || seasonNumber != null);

  async function save() {
    if (!title || !canSave) return;
    setSaving(true);
    await logWatch({
      title,
      seasonNumber: title.type === "tv" ? seasonNumber : null,
      watchedOn: date || localDateString(),
      note,
      watchers,
      pickedBy,
      scores: editable.map((person) => ({ userId: person.id, score: scores[person.id] })),
    });
    setSaving(false);
    onSaved(title);
  }

  const chosen = Object.values(scores);
  const average = chosen.length
    ? Math.round((chosen.reduce((sum, score) => sum + score, 0) / chosen.length) * 10) / 10
    : null;
  const hasBackdrop = Boolean(title?.backdropPath);

  return (
    <Drawer open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DrawerContent aria-label={`Log ${title?.name ?? "a watch"}`}>
        <header className="flex items-center justify-between">
          <span className="text-muted text-xs tracking-[0.08em] uppercase">Log a watch</span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3.5">
              <Skeleton className="aspect-[2/3] w-24" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : title ? (
          <>
            <div
              className={cn(
                "relative -mx-4 -mt-4 overflow-hidden",
                hasBackdrop && "rounded-t-[20px]",
              )}
            >
              {hasBackdrop ? (
                <>
                  <Backdrop title={title} className="h-40 w-full" />
                  <div className="from-surface absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t to-transparent" />
                </>
              ) : null}
              <div className={cn("flex gap-3.5 px-4", hasBackdrop ? "relative -mt-20" : "pt-1")}>
                <Poster
                  title={title}
                  className={cn(hasBackdrop && "ring-surface shadow-lg ring-4")}
                />
                <div className="flex min-w-0 flex-col gap-1.5 pt-1">
                  <h2 className="text-[19px] leading-tight font-semibold">
                    {title.name}{" "}
                    {title.year ? <span className="text-muted">({title.year})</span> : null}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {title.genres.slice(0, 3).map((genre) => (
                      <span key={genre} className="text-muted">
                        {genre}
                      </span>
                    ))}
                  </div>
                  {title.directors.length ? (
                    <p className="text-muted text-xs">Directed by {title.directors.join(", ")}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {title.critic?.imdb != null ? (
                      <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                        IMDb {title.critic.imdb}
                      </span>
                    ) : null}
                    {title.critic?.rt != null ? (
                      <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                        RT {title.critic.rt}%
                      </span>
                    ) : null}
                    {title.critic?.metacritic != null ? (
                      <span className="border-accent/35 bg-accent/8 inline-flex rounded-full border px-2.5 py-0.5 text-[11.5px] text-[#d8c08d]">
                        MC {title.critic.metacritic}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {title.type === "tv" ? (
              <div className="flex flex-col gap-2">
                <label className="text-muted text-[13px]" htmlFor="season-select">
                  Season
                </label>
                {title.seasons.length ? (
                  <Select
                    id="season-select"
                    value={seasonNumber ?? ""}
                    onChange={(event) => setSeasonNumber(Number(event.target.value))}
                  >
                    {title.seasons.map((item) => (
                      <option key={item.seasonNumber} value={item.seasonNumber}>
                        {item.name} · {item.episodeCount} episodes
                        {item.year ? ` · ${item.year}` : ""}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    value={seasonNumber ?? 1}
                    onChange={(event) =>
                      setSeasonNumber(Math.max(1, Number(event.target.value) || 1))
                    }
                  />
                )}
                {seasonEstimate ? (
                  <p className="text-muted text-[13px]">
                    About {formatMinutes(seasonEstimate)} of watching
                  </p>
                ) : null}
                {recentTvWatches < 3 ? (
                  <p className="text-muted text-[12.5px]">
                    Each season gets its own rating, so you can see how a show changes over time.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label className="text-muted text-[13px]" htmlFor="watch-date">
                Watched on
              </label>
              <Input
                id="watch-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted text-[13px]">Who watched?</span>
              <div className="border-line bg-surface flex gap-1.5 rounded-xl border p-1">
                {watchOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "text-muted flex-1 rounded-[9px] px-2 py-2 text-[13px] font-semibold transition-colors",
                      watchMode === option.id && "bg-surface-2 text-ink ring-accent/45 ring-1",
                    )}
                    onClick={() => setWatchMode(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {entries.length < 3 ? (
                <p className="text-muted text-[12.5px]">
                  Together means you both rate it; solo counts only for that person.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted text-[13px]">Who picked it?</span>
              <div className="border-line bg-surface flex gap-1.5 rounded-xl border p-1">
                <button
                  type="button"
                  className={cn(
                    "text-muted flex-1 rounded-[9px] px-2 py-2 text-[13px] font-semibold transition-colors",
                    pickedBy === null && "bg-surface-2 text-ink ring-accent/45 ring-1",
                  )}
                  onClick={() => setPickedBy(null)}
                >
                  Not sure
                </button>
                {people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={cn(
                      "text-muted flex-1 rounded-[9px] px-2 py-2 text-[13px] font-semibold transition-colors",
                      pickedBy === person.id && "bg-surface-2 text-ink ring-accent/45 ring-1",
                    )}
                    onClick={() => setPickedBy(person.id)}
                  >
                    {person.id === userId ? "Me" : nameFor(person.id)}
                  </button>
                ))}
              </div>
            </div>

            {watcherPeople.map((person) => (
              <div key={person.id} className="flex flex-col gap-2">
                <span className="text-muted text-[13px]">
                  {nameFor(person.id)}
                  {canEditScore(person.id, watchers) ? "" : " — waiting for them"}
                </span>
                <RatingPicker
                  value={scores[person.id] ?? null}
                  onChange={(score) => setScores((current) => ({ ...current, [person.id]: score }))}
                  disabled={!canEditScore(person.id, watchers)}
                  ariaLabel={`${nameFor(person.id)} rating`}
                />
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <label className="text-muted text-[13px]" htmlFor="watch-note">
                Note
              </label>
              <Textarea
                id="watch-note"
                rows={2}
                placeholder="Optional — where you watched, who picked it, hot takes…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-2.5">
              <ScoreChip score={average} label="Avg" />
              <Button onClick={() => void save()} disabled={!canSave}>
                {saving ? "Saving…" : "Save watch"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted py-8 text-center text-sm">Could not load this title.</p>
        )}
      </DrawerContent>
    </Drawer>
  );
}
