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
import { Chip } from "@/components/ui/chip";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
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
  const { people, userId, canEditScore, logWatch, nameFor, entries } = useStore();
  const [title, setTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeasons, setSelectedSeasons] = useState<number[] | null>(null);
  const [date, setDate] = useState(localDateString());
  const [dateUnknown, setDateUnknown] = useState(false);
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
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [summary]);

  const watchOptions: { id: string; label: string; watchers: string[] }[] = [
    { id: "together", label: "Together", watchers: people.map((person) => person.id) },
  ];
  if (userId) {
    watchOptions.push({
      id: `solo:${userId}`,
      label: `Just ${nameFor(userId)}`,
      watchers: [userId],
    });
  }
  const selectedOption = watchOptions.find((option) => option.id === watchMode) ?? watchOptions[0];
  const watchers = selectedOption.watchers;
  const watcherPeople = people.filter((person) => watchers.includes(person.id));
  const editable = watcherPeople.filter((person) => canEditScore(person.id, watchers));

  const recentTvWatches = entries.filter((entry) => entry.title.type === "tv").length;
  const episodeCount =
    title?.type !== "tv"
      ? 0
      : selectedSeasons == null
        ? title.seasons.reduce((sum, item) => sum + item.episodeCount, 0)
        : title.seasons
            .filter((item) => selectedSeasons.includes(item.seasonNumber))
            .reduce((sum, item) => sum + item.episodeCount, 0);
  const seasonEstimate =
    title?.type === "tv" && title.runtimeMinutes != null && episodeCount > 0
      ? title.runtimeMinutes * episodeCount
      : title?.type === "tv"
        ? title?.runtimeMinutes
        : null;
  const canSave =
    !loading &&
    !saving &&
    Boolean(title) &&
    (dateUnknown || /^\d{4}-\d{2}-\d{2}$/.test(date)) &&
    (title?.type !== "tv" || selectedSeasons == null || selectedSeasons.length > 0) &&
    editable.every((person) => scores[person.id] != null);

  const dirty =
    !loading &&
    (Object.keys(scores).length > 0 ||
      note.trim().length > 0 ||
      pickedBy !== null ||
      watchMode !== "together" ||
      selectedSeasons !== null);

  function requestClose() {
    if (saving || (dirty && !window.confirm("Discard this watch?"))) return;
    onClose();
  }

  function toggleSeason(seasonNumber: number) {
    setSelectedSeasons((current) => {
      if (current == null) return [seasonNumber];
      if (current.includes(seasonNumber)) {
        return current.filter((value) => value !== seasonNumber);
      }
      return [...current, seasonNumber].sort((a, b) => a - b);
    });
  }

  async function save() {
    if (!title || !canSave) return;
    setSaving(true);
    try {
      const saved = await logWatch({
        title,
        seasonNumbers: title.type === "tv" ? selectedSeasons : null,
        watchedOn: dateUnknown ? null : date,
        note,
        watchers,
        pickedBy,
        scores: editable.map((person) => ({ userId: person.id, score: scores[person.id] })),
      });
      if (saved) onSaved(title);
    } finally {
      setSaving(false);
    }
  }

  const chosen = Object.values(scores);
  const average = chosen.length
    ? Math.round((chosen.reduce((sum, score) => sum + score, 0) / chosen.length) * 10) / 10
    : null;
  const hasBackdrop = Boolean(title?.backdropPath);

  return (
    <Drawer open onOpenChange={(open) => (!open ? requestClose() : undefined)}>
      <DrawerContent aria-label={`Log ${title?.name ?? "a watch"}`}>
        <header className="flex items-center justify-between">
          <span className="text-muted text-xs tracking-[0.08em] uppercase">Log a watch</span>
          <Button variant="ghost" size="sm" onClick={requestClose}>
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
            <div className="relative -mx-4 -mt-4">
              {hasBackdrop ? (
                <div className="relative h-40 overflow-hidden rounded-t-[20px]">
                  <Backdrop title={title} className="h-full w-full" />
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
                <span className="text-muted text-[13px]">Seasons watched</span>
                {title.seasons.length ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        active={selectedSeasons == null}
                        aria-pressed={selectedSeasons == null}
                        onClick={() => setSelectedSeasons(null)}
                      >
                        Whole show
                      </Chip>
                      {title.seasons.map((item) => {
                        const active = selectedSeasons?.includes(item.seasonNumber) ?? false;
                        return (
                          <Chip
                            key={item.seasonNumber}
                            active={active}
                            aria-pressed={active}
                            title={`${item.name} · ${item.episodeCount} episodes${
                              item.year ? ` · ${item.year}` : ""
                            }`}
                            onClick={() => toggleSeason(item.seasonNumber)}
                          >
                            S{item.seasonNumber}
                          </Chip>
                        );
                      })}
                    </div>
                    <p className="text-muted text-[13px]">
                      {selectedSeasons == null
                        ? `Whole show · one rating${
                            seasonEstimate ? ` · about ${formatMinutes(seasonEstimate)}` : ""
                          }`
                        : selectedSeasons.length
                          ? `${selectedSeasons.length} ${
                              selectedSeasons.length === 1 ? "season" : "seasons"
                            } · one rating${
                              seasonEstimate ? ` · about ${formatMinutes(seasonEstimate)}` : ""
                            }`
                          : "Pick at least one season, or choose Whole show."}
                    </p>
                  </>
                ) : (
                  <p className="text-muted text-[13px]">
                    No season list for this show — logging the whole show.
                  </p>
                )}
                {recentTvWatches < 3 && title.seasons.length ? (
                  <p className="text-muted text-[12.5px]">
                    Tap the seasons you've seen — one rating covers the whole run.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-muted text-[13px]" htmlFor="watch-date">
                  Watched on
                </label>
                <button
                  type="button"
                  className={cn(
                    "border-line text-muted rounded-full border px-2.5 py-1 text-xs transition-colors",
                    dateUnknown && "border-accent bg-accent/8 text-ink",
                  )}
                  aria-pressed={dateUnknown}
                  onClick={() => setDateUnknown((current) => !current)}
                >
                  Not sure
                </button>
              </div>
              {dateUnknown ? (
                <p className="text-muted text-[13px]">
                  No date — it won't appear in date-based charts.
                </p>
              ) : (
                <>
                  <Input
                    id="watch-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  {date && !/^\d{4}-\d{2}-\d{2}$/.test(date) ? (
                    <p className="text-bad text-[12.5px]">Pick a date or tap Not sure.</p>
                  ) : null}
                </>
              )}
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
