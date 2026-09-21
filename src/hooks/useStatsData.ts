import { useMemo } from "react";
import type { TrendRow } from "@/components/stats/chart";
import {
  buildInsights,
  buildTasteProfile,
  compareMonthly,
  compatibility,
  creditStats,
  criticComparison,
  criticOutliers,
  decadeCounts,
  decadeStats,
  divergences,
  genreAffinity,
  genreGapStats,
  genreStats,
  jointEntries,
  languageStats,
  makeScorer,
  monthlyCounts,
  monthsForYear,
  predictionAccuracy,
  queueStats,
  ratingDistribution,
  rewatchStats,
  runtimePoints,
  scoreStats,
  soloEntries,
  totalMinutes,
  watchMinutes,
  watchStreaks,
  weekdayCounts,
  yearsPresent,
  type Scorer,
} from "@/lib/analytics";
import { useStore } from "@/lib/store";

export function useStatsData({
  scopeId,
  yearFilter,
  typeFilter,
}: {
  scopeId: string;
  yearFilter: string;
  typeFilter: "all" | "movie" | "tv";
}) {
  const { entries, people, nameFor, listItems, titles } = useStore();

  const years = useMemo(() => yearsPresent(entries), [entries]);
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (yearFilter === "all" || (entry.watch.watchedOn?.startsWith(yearFilter) ?? false)) &&
          (typeFilter === "all" || entry.title.type === typeFilter),
      ),
    [entries, yearFilter, typeFilter],
  );

  const joint = useMemo(() => jointEntries(filtered), [filtered]);
  const scoped = useMemo(
    () => (scopeId === "together" ? joint : soloEntries(filtered, scopeId)),
    [filtered, joint, scopeId],
  );
  const scorer: Scorer = useMemo(
    () => makeScorer(scopeId === "together" ? null : scopeId),
    [scopeId],
  );

  const pair = people.length >= 2 ? { a: people[0], b: people[1] } : null;
  const pairA = pair?.a.id ?? null;
  const pairB = pair?.b.id ?? null;

  const movies = useMemo(
    () => scoped.filter((entry) => entry.title.type === "movie").length,
    [scoped],
  );
  const seasons = scoped.length - movies;
  const minutes = useMemo(() => totalMinutes(scoped), [scoped]);
  const overall = useMemo(() => scoreStats(scoped, scorer), [scoped, scorer]);
  const genres = useMemo(() => genreStats(scoped, scorer, 8), [scoped, scorer]);
  const actors = useMemo(() => creditStats(scoped, "cast", scorer, 8), [scoped, scorer]);
  const directors = useMemo(() => creditStats(scoped, "directors", scorer, 8), [scoped, scorer]);
  const critics = useMemo(() => criticComparison(scoped, scorer), [scoped, scorer]);
  const outliers = useMemo(() => criticOutliers(scoped, scorer, 5), [scoped, scorer]);
  const months = useMemo(
    () => (yearFilter === "all" ? monthlyCounts(scoped, 12) : monthsForYear(scoped, yearFilter)),
    [scoped, yearFilter],
  );
  const decades = useMemo(() => decadeCounts(scoped), [scoped]);
  const streaks = useMemo(() => watchStreaks(scoped), [scoped]);
  const weekdays = useMemo(() => weekdayCounts(scoped), [scoped]);
  const queue = useMemo(() => queueStats(listItems, entries), [listItems, entries]);
  const queueOldest = queue.oldestWaitingKey ? (titles[queue.oldestWaitingKey] ?? null) : null;
  const personHistory = useMemo(
    () =>
      people.map((person) => ({
        person,
        stats: scoreStats(filtered, makeScorer(person.id)),
        distribution: ratingDistribution(filtered, makeScorer(person.id)),
      })),
    [people, filtered],
  );
  const habitNote = (() => {
    if (personHistory.length < 2) return "";
    const [first, second] = personHistory;
    const a = first.stats.avg;
    const b = second.stats.avg;
    if (a == null || b == null || first.stats.count < 3 || second.stats.count < 3) return "";
    const diff = Math.round(Math.abs(a - b) * 10) / 10;
    if (diff < 0.3) return "you rate almost identically";
    return a > b
      ? `${nameFor(second.person.id)} rates ~${diff} higher`
      : `${nameFor(first.person.id)} rates ~${diff} higher`;
  })();
  const trend = useMemo<TrendRow[]>(() => {
    const rows = months.map((month) => ({
      key: month.key,
      label: month.label,
      count: month.count,
      movie: 0,
      tv: 0,
      joint: 0,
      a: 0,
      b: 0,
    }));
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const entry of scoped) {
      const watchedOn = entry.watch.watchedOn;
      if (!watchedOn) continue;
      const bucket = byKey.get(watchedOn.slice(0, 7));
      if (!bucket) continue;
      const entryMinutes = watchMinutes(entry) ?? 0;
      if (entry.title.type === "movie") bucket.movie += entryMinutes;
      else bucket.tv += entryMinutes;
    }
    return rows.map((row) => ({
      ...row,
      movie: Math.round((row.movie / 60) * 10) / 10,
      tv: Math.round((row.tv / 60) * 10) / 10,
    }));
  }, [months, scoped]);
  const insights = useMemo(() => buildInsights(entries, people), [entries, people]);
  const duels = pairA && pairB ? genreGapStats(joint, pairA, pairB, 8) : [];
  const duelMax = Math.max(1, ...duels.map((row) => Math.abs(row.gap)));
  const compareData = useMemo<TrendRow[]>(
    () =>
      compareMonthly(filtered, people, months).map((row) => ({
        ...row,
        count: row.joint + row.a + row.b,
        movie: 0,
        tv: 0,
      })),
    [filtered, people, months],
  );
  const languages = useMemo(() => languageStats(scoped), [scoped]);
  const eraStats = useMemo(() => decadeStats(scoped, scorer), [scoped, scorer]);
  const runtimeData = useMemo(() => runtimePoints(scoped, scorer), [scoped, scorer]);
  const rewatches = useMemo(() => rewatchStats(entries), [entries]);
  const missingEnrichment = Object.values(titles).filter(
    (title) => title.tmdbId && !title.originalLanguage,
  ).length;

  const compat = pairA && pairB ? compatibility(joint, pairA, pairB) : null;
  const gaps = pairA && pairB ? divergences(joint, pairA, pairB) : [];
  const mostDivisive = gaps.slice(0, 3);
  const mostInSync = gaps.slice(-3).reverse();
  const accuracies = useMemo(
    () => people.map((person) => predictionAccuracy(entries, person.id)),
    [entries, people],
  );

  const profiles = useMemo(
    () => people.map((person) => buildTasteProfile(entries, person.id)),
    [entries, people],
  );
  const radarGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const genre of entry.title.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [entries]);
  const radarReady =
    pair && radarGenres.length >= 3 && profiles.every((profile) => profile.count >= 3);
  const radarData = radarReady
    ? radarGenres.map((genre) => {
        const row: Record<string, string | number> = { genre };
        for (const profile of profiles) {
          row[nameFor(profile.personId)] = genreAffinity(profile, genre) ?? 0;
        }
        return row;
      })
    : [];

  return {
    years,
    filtered,
    joint,
    scoped,
    movies,
    seasons,
    minutes,
    overall,
    genres,
    actors,
    directors,
    critics,
    outliers,
    months,
    decades,
    streaks,
    weekdays,
    queue,
    queueOldest,
    personHistory,
    habitNote,
    trend,
    insights,
    duels,
    duelMax,
    compareData,
    languages,
    eraStats,
    runtimeData,
    rewatches,
    missingEnrichment,
    compat,
    gaps,
    mostDivisive,
    mostInSync,
    accuracies,
    profiles,
    radarReady,
    radarData,
    pair,
  };
}
