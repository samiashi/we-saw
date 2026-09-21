import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Search } from "lucide-react";
import {
  fallbackTitle,
  fetchSimilar,
  fetchTitleDetails,
  fetchTrending,
  searchCatalog,
} from "@/lib/api";
import { buildTasteProfile, safeSummaryScore } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/useToast";
import type { Title, TitleSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DiscoveryRow } from "@/components/DiscoveryRow";
import { DiscoverySheet } from "@/components/DiscoverySheet";
import { LogSheet } from "@/components/LogSheet";
import { Poster } from "@/components/Poster";
import { WatchCard } from "@/components/WatchCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function LogView() {
  const { entries, addToList, people } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TitleSummary[]>([]);
  const [source, setSource] = useState<"tmdb" | "local" | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TitleSummary | null>(null);
  const [trending, setTrending] = useState<TitleSummary[] | null>(null);
  const [similar, setSimilar] = useState<{ seed: Title; items: TitleSummary[] } | null>(null);
  const [discovery, setDiscovery] = useState<TitleSummary | null>(null);
  const [sort, setSort] = useState<"popular" | "taste">("popular");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const profiles = useMemo(
    () => people.map((person) => buildTasteProfile(entries, person.id)),
    [entries, people],
  );
  const engineReady = profiles.some((profile) => profile.count >= 3);
  const seed = useMemo(() => {
    const loved = entries
      .filter(
        (entry) => entry.combined != null && entry.combined >= 8 && entry.title.tmdbId != null,
      )
      .sort(
        (a, b) =>
          (b.combined ?? 0) - (a.combined ?? 0) ||
          (b.watch.watchedOn ?? "").localeCompare(a.watch.watchedOn ?? ""),
      );
    return loved[0]?.title ?? null;
  }, [entries]);
  const showResults = query.trim().length >= 2;

  function rank(items: TitleSummary[]): TitleSummary[] {
    if (sort !== "taste" || !engineReady) return items;
    return [...items].sort(
      (a, b) => (safeSummaryScore(profiles, b) ?? 0) - (safeSummaryScore(profiles, a) ?? 0),
    );
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      requestId.current += 1;
      return;
    }

    debounce.current = setTimeout(async () => {
      const id = requestId.current + 1;
      requestId.current = id;
      setSearching(true);
      const response = await searchCatalog(trimmed);
      if (requestId.current !== id) return;
      setResults(response.results);
      setSource(response.source);
      setSearching(false);
    }, 350);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  useEffect(() => {
    if (showResults) return;
    let active = true;
    void fetchTrending().then((items) => {
      if (active) setTrending(items);
    });
    return () => {
      active = false;
    };
  }, [showResults]);

  useEffect(() => {
    if (showResults || !seed?.tmdbId) return;
    let active = true;
    void fetchSimilar(seed.type, seed.tmdbId).then((items) => {
      if (active) setSimilar({ seed, items });
    });
    return () => {
      active = false;
    };
  }, [showResults, seed]);

  function handleSaved(title: Title) {
    setSelected(null);
    setQuery("");
    setResults([]);
    setSource(null);
    toast.show(`Logged ${title.name}`);
  }

  async function quickAdd(summary: TitleSummary) {
    const details = (await fetchTitleDetails(summary)) ?? fallbackTitle(summary);
    const added = await addToList(details);
    toast.show(
      added ? `Added ${details.name} to Up Next` : `${details.name} is already on the list`,
    );
  }

  function handleDiscoveryLog(summary: TitleSummary) {
    setDiscovery(null);
    setSelected(summary);
  }

  const recent = entries.slice(0, 5);

  return (
    <div className="flex flex-col gap-[18px]">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight">Log a watch</h1>
        <p className="text-muted mt-1 text-sm">Find a movie or show, then rate it together.</p>
      </header>

      <div className="relative">
        <Search size={18} className="text-muted absolute top-1/2 left-3.5 -translate-y-1/2" />
        <Input
          className="pl-11"
          type="search"
          placeholder="Search movies and shows…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {showResults && source === "local" && results.length ? (
        <p className="text-muted text-[13px]">
          Showing the offline starter catalog — add a TMDB key for full search.
        </p>
      ) : null}

      {showResults && searching ? <p className="text-muted text-[13px]">Searching…</p> : null}

      {showResults && results.length ? (
        <div className="grid auto-rows-fr grid-cols-1 gap-2">
          {results.map((result) => (
            <div
              key={result.key}
              className="border-line bg-surface flex items-center gap-1.5 rounded-2xl border p-3"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setSelected(result)}
              >
                <Poster title={result} variant="small" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[15px] font-semibold">{result.name}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="border-line text-muted inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] tracking-[0.06em] uppercase">
                      {result.type === "movie" ? "Movie" : "TV"}
                    </span>
                    {result.year ? <span className="text-muted">{result.year}</span> : null}
                  </span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                title="Add to Up Next"
                aria-label={`Add ${result.name} to Up Next`}
                onClick={() => void quickAdd(result)}
              >
                <BookmarkPlus size={18} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {showResults && !searching && !results.length ? (
        <p className="text-muted text-[13px]">No matches. Try another spelling.</p>
      ) : null}

      {!showResults ? (
        <>
          {trending === null ? (
            <Skeleton className="h-[190px] w-full" />
          ) : (
            <DiscoveryRow
              title="Popular this week"
              items={rank(trending)}
              profiles={profiles}
              onOpen={setDiscovery}
              headerRight={
                engineReady ? (
                  <div className="flex gap-1.5">
                    {(["popular", "taste"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={cn(
                          "border-line text-muted rounded-full border px-2.5 py-1 text-xs transition-colors",
                          sort === option && "border-accent bg-accent/8 text-ink",
                        )}
                        onClick={() => setSort(option)}
                      >
                        {option === "popular" ? "Popular" : "Safe for us"}
                      </button>
                    ))}
                  </div>
                ) : null
              }
            />
          )}
          {similar ? (
            <DiscoveryRow
              title={`Because you loved ${similar.seed.name}`}
              items={rank(similar.items)}
              profiles={profiles}
              onOpen={setDiscovery}
            />
          ) : null}
        </>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-semibold">Recent watches</h2>
        {recent.length ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-2">
            {recent.map((entry) => (
              <WatchCard key={entry.watch.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-muted text-[13px]">
            Nothing logged yet. Search above to add your first watch.
          </p>
        )}
      </section>

      {selected ? (
        <LogSheet summary={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      ) : null}

      {discovery ? (
        <DiscoverySheet
          summary={discovery}
          onClose={() => setDiscovery(null)}
          onLog={handleDiscoveryLog}
        />
      ) : null}
    </div>
  );
}
