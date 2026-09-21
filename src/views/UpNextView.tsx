import { useEffect, useMemo, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { LogSheet } from "@/components/LogSheet";
import { Poster } from "@/components/Poster";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import {
  buildTasteProfile,
  predictScore,
  rankPicks,
  topGenreOverlap,
  type Prediction,
} from "@/lib/analytics";
import { fetchAirdates, titleToSummary } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { ListItem, ListStatus, NextEpisode, Title, TitleSummary } from "@/lib/types";

const statusLabels: Record<Exclude<ListStatus, "done">, string> = {
  watching: "Watching",
  queued: "Queued",
  dropped: "Dropped",
};

function NextEpisodeChip({ episode }: { episode: NextEpisode | null | undefined }) {
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

function PredictionChips({ predictions }: { predictions: Prediction[] }) {
  const { people, nameFor } = useStore();

  return (
    <div className="flex flex-wrap gap-1.5">
      {predictions.map((prediction, index) => (
        <span
          key={people[index]?.id ?? index}
          className="inline-flex items-center rounded-full border border-[#78b4ff]/40 bg-[#78b4ff]/12 px-2.5 py-0.5 text-[11.5px] whitespace-nowrap text-[#bfe3ff]"
        >
          {people[index] ? nameFor(people[index].id) : "?"} {prediction.score}
        </span>
      ))}
    </div>
  );
}

function ListRow({
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

  return (
    <div className="border-line bg-surface flex h-full items-start gap-3 rounded-2xl border p-3">
      <Poster title={title} variant="small" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch">
        <span className="truncate text-[15px] font-semibold">
          {title.name}
          {title.year ? <span className="text-muted font-medium"> · {title.year}</span> : null}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="border-line text-muted inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] uppercase">
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
          <Chip onClick={() => void removeFromList(item.id)}>Remove</Chip>
        </div>
      </div>
    </div>
  );
}

export function UpNextView() {
  const { listItems, titles, entries, people, nameFor } = useStore();
  const [selected, setSelected] = useState<TitleSummary | null>(null);
  const [flash, setFlash] = useState("");
  const [air, setAir] = useState<Record<string, NextEpisode | null>>({});

  const resolved = useMemo(
    () =>
      listItems
        .filter((item) => item.status !== "done")
        .map((item) => ({ item, title: titles[item.titleKey] }))
        .filter((row): row is { item: ListItem; title: Title } => Boolean(row.title)),
    [listItems, titles],
  );

  const profiles = useMemo(
    () => people.map((person) => buildTasteProfile(entries, person.id)),
    [entries, people],
  );
  const engineReady = profiles.some((profile) => profile.count >= 3);

  const airKey = useMemo(
    () =>
      resolved
        .filter((row) => row.title.type === "tv" && row.item.status !== "dropped")
        .map((row) => row.title.key)
        .join(","),
    [resolved],
  );

  useEffect(() => {
    if (!airKey) return;
    let active = true;
    void fetchAirdates(airKey.split(",")).then((map) => {
      if (active) setAir(map);
    });
    return () => {
      active = false;
    };
  }, [airKey]);

  const predictionMap = useMemo(() => {
    const map = new Map<string, Prediction[]>();
    if (!engineReady) return map;
    for (const { title } of resolved)
      map.set(
        title.key,
        profiles.map((profile) => predictScore(profile, title)),
      );
    return map;
  }, [resolved, profiles, engineReady]);

  const tonight = useMemo(() => {
    if (!engineReady) return null;
    const active = resolved.filter((row) => row.item.status !== "dropped").map((row) => row.title);
    return rankPicks(active, profiles)[0] ?? null;
  }, [resolved, profiles, engineReady]);

  const pickReason = useMemo(() => {
    if (!tonight) return "";
    const overlaps = profiles.map((profile) => topGenreOverlap(profile, tonight.title));
    const [first, second] = overlaps;
    if (first && second && first === second) return `You both rate ${first} high.`;
    const named = profiles
      .map((profile, index) =>
        overlaps[index] ? `${nameFor(profile.personId)} rates ${overlaps[index]} high` : null,
      )
      .filter(Boolean);
    return named.length
      ? `${named.join(" · ")}.`
      : "The closest thing to a sure thing on your list.";
  }, [tonight, profiles, nameFor]);

  const groups: { status: Exclude<ListStatus, "done">; rows: typeof resolved }[] = [
    { status: "watching", rows: resolved.filter((row) => row.item.status === "watching") },
    { status: "queued", rows: resolved.filter((row) => row.item.status === "queued") },
    { status: "dropped", rows: resolved.filter((row) => row.item.status === "dropped") },
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight">Up Next</h1>
        <p className="text-muted mt-1 text-sm">What's lined up, in progress, or abandoned.</p>
      </header>

      {flash ? (
        <span role="status" className="text-good text-[13px]">
          {flash}
        </span>
      ) : null}

      {tonight ? (
        <section className="border-accent/35 bg-surface flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Tonight's pick</h2>
            <span className="text-muted inline-flex items-center gap-1 text-[13px]">
              <Sparkles size={12} /> Safe for both
            </span>
          </div>
          <div className="flex gap-3.5">
            <Poster title={tonight.title} size="w342" />
            <div className="flex min-w-0 flex-col items-start gap-2">
              <h3 className="text-lg font-semibold">{tonight.title.name}</h3>
              <p className="text-muted text-[13px]">{pickReason}</p>
              <PredictionChips predictions={tonight.predictions} />
              <Button size="sm" onClick={() => setSelected(titleToSummary(tonight.title))}>
                <Play size={14} /> Log this watch
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {!resolved.length ? (
        <p className="text-muted text-[13px]">
          Nothing on the list yet. Search in the Log tab and tap the bookmark to add something.
        </p>
      ) : null}

      {groups.map((group) =>
        group.rows.length ? (
          <section key={group.status} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-semibold">{statusLabels[group.status]}</h2>
              <span className="text-muted text-[13px]">{group.rows.length}</span>
            </div>
            <div className="grid auto-rows-fr gap-2">
              {group.rows.map(({ item, title }) => (
                <ListRow
                  key={item.id}
                  item={item}
                  title={title}
                  predictions={predictionMap.get(title.key) ?? null}
                  nextEpisode={air[title.key] ?? title.nextEpisode ?? null}
                  onLog={setSelected}
                />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {selected ? (
        <LogSheet
          summary={selected}
          onClose={() => setSelected(null)}
          onSaved={(title) => {
            setSelected(null);
            setFlash(`Logged ${title.name}`);
            setTimeout(() => setFlash(""), 2500);
          }}
        />
      ) : null}
    </div>
  );
}
