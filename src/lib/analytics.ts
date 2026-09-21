import { localDateString } from "@/lib/dates";
import type { Entry, ListItem, MediaType, Person, Rating, Title, Watch } from "@/lib/types";

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortDate(entry: Entry): string {
  if (entry.watch.watchedOn) return entry.watch.watchedOn;
  const created = new Date(entry.watch.createdAt);
  return Number.isNaN(created.getTime()) ? "" : localDateString(created);
}

export function buildEntries(titles: Title[], watches: Watch[], ratings: Rating[]): Entry[] {
  const titlesByKey = new Map(titles.map((title) => [title.key, title]));
  const ratingsByWatch = new Map<string, Record<string, number>>();

  for (const rating of ratings) {
    const bucket = ratingsByWatch.get(rating.watchId) ?? {};
    bucket[rating.userId] = rating.score;
    ratingsByWatch.set(rating.watchId, bucket);
  }

  const entries: Entry[] = [];

  for (const watch of watches) {
    const title = titlesByKey.get(watch.titleKey);
    if (!title) continue;
    const scores = ratingsByWatch.get(watch.id) ?? {};
    const values = Object.values(scores);
    const combined = values.length ? round1(mean(values)) : null;
    const gap = values.length >= 2 ? Math.max(...values) - Math.min(...values) : null;
    entries.push({ watch, title, scores, combined, gap });
  }

  return entries.sort(
    (a, b) =>
      sortDate(b).localeCompare(sortDate(a)) || b.watch.createdAt.localeCompare(a.watch.createdAt),
  );
}

export type Scorer = (entry: Entry) => number | null;

export function makeScorer(personId?: string | null): Scorer {
  if (!personId) return (entry) => entry.combined;
  return (entry) => entry.scores[personId] ?? null;
}

export interface StatRow {
  name: string;
  count: number;
  avg: number | null;
}

function statsFromNames(
  entries: Entry[],
  namesOf: (title: Title) => string[],
  scorer: Scorer,
  limit: number,
): StatRow[] {
  const buckets = new Map<string, { count: number; scores: number[] }>();

  for (const entry of entries) {
    const score = scorer(entry);
    for (const name of new Set(namesOf(entry.title))) {
      if (!name) continue;
      const bucket = buckets.get(name) ?? { count: 0, scores: [] };
      bucket.count += 1;
      if (score !== null) bucket.scores.push(score);
      buckets.set(name, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([name, bucket]) => ({
      name,
      count: bucket.count,
      avg: bucket.scores.length ? round1(mean(bucket.scores)) : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, limit);
}

export function genreStats(entries: Entry[], scorer: Scorer, limit = 8): StatRow[] {
  return statsFromNames(entries, (title) => title.genres, scorer, limit);
}

export function creditStats(
  entries: Entry[],
  kind: "cast" | "directors",
  scorer: Scorer,
  limit = 8,
): StatRow[] {
  return statsFromNames(
    entries,
    (title) => (kind === "cast" ? title.cast : title.directors),
    scorer,
    limit,
  );
}

export function scoreStats(
  entries: Entry[],
  scorer: Scorer,
): { count: number; avg: number | null } {
  const scores = entries.map(scorer).filter((score): score is number => score !== null);
  return { count: scores.length, avg: scores.length ? round1(mean(scores)) : null };
}

function pearson(pairs: [number, number][]): number | null {
  if (pairs.length < 3) return null;
  const xs = pairs.map((pair) => pair[0]);
  const ys = pairs.map((pair) => pair[1]);
  const mx = mean(xs);
  const my = mean(ys);
  let numerator = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    const a = x - mx;
    const b = y - my;
    numerator += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return round2(numerator / Math.sqrt(dx * dy));
}

export interface Compatibility {
  sharedCount: number;
  avgGap: number | null;
  closeShare: number | null;
  correlation: number | null;
}

export function compatibility(entries: Entry[], personA: string, personB: string): Compatibility {
  const pairs: [number, number][] = [];
  const gaps: number[] = [];

  for (const entry of entries) {
    const a = entry.scores[personA];
    const b = entry.scores[personB];
    if (a === undefined || b === undefined) continue;
    pairs.push([a, b]);
    gaps.push(Math.abs(a - b));
  }

  return {
    sharedCount: pairs.length,
    avgGap: gaps.length ? round1(mean(gaps)) : null,
    closeShare: gaps.length
      ? round1((gaps.filter((gap) => gap <= 2).length / gaps.length) * 100)
      : null,
    correlation: pearson(pairs),
  };
}

export interface Divergence {
  entry: Entry;
  scoreA: number;
  scoreB: number;
  gap: number;
}

export function divergences(entries: Entry[], personA: string, personB: string): Divergence[] {
  const rows: Divergence[] = [];

  for (const entry of entries) {
    const a = entry.scores[personA];
    const b = entry.scores[personB];
    if (a === undefined || b === undefined) continue;
    rows.push({ entry, scoreA: a, scoreB: b, gap: Math.abs(a - b) });
  }

  return rows.sort((x, y) => y.gap - x.gap);
}

export interface CriticGap {
  source: "IMDb" | "RT" | "Metacritic";
  criticAvg: number;
  userAvg: number;
  delta: number;
  count: number;
}

export function criticComparison(entries: Entry[], scorer: Scorer): CriticGap[] {
  const sources: {
    source: CriticGap["source"];
    pick: (entry: Entry) => number | null | undefined;
  }[] = [
    { source: "IMDb", pick: (entry) => entry.title.critic?.imdb },
    {
      source: "RT",
      pick: (entry) => (entry.title.critic?.rt != null ? entry.title.critic.rt / 10 : null),
    },
    {
      source: "Metacritic",
      pick: (entry) =>
        entry.title.critic?.metacritic != null ? entry.title.critic.metacritic / 10 : null,
    },
  ];

  const rows: CriticGap[] = [];

  for (const { source, pick } of sources) {
    const criticScores: number[] = [];
    const userScores: number[] = [];

    for (const entry of entries) {
      const critic = pick(entry);
      const user = scorer(entry);
      if (critic == null || user === null) continue;
      criticScores.push(critic);
      userScores.push(user);
    }

    if (!criticScores.length) continue;
    const criticAvg = round1(mean(criticScores));
    const userAvg = round1(mean(userScores));
    rows.push({
      source,
      criticAvg,
      userAvg,
      delta: round1(userAvg - criticAvg),
      count: criticScores.length,
    });
  }

  return rows;
}

export interface CriticOutlier {
  entry: Entry;
  critic: number;
  user: number;
  delta: number;
}

export function criticOutliers(entries: Entry[], scorer: Scorer, limit = 5): CriticOutlier[] {
  const rows: CriticOutlier[] = [];

  for (const entry of entries) {
    const critic =
      entry.title.critic?.imdb ??
      (entry.title.critic?.rt != null ? entry.title.critic.rt / 10 : null);
    const user = scorer(entry);
    if (critic == null || user === null) continue;
    rows.push({ entry, critic: round1(critic), user, delta: round1(user - critic) });
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

export function watchMinutes(entry: Entry): number | null {
  const { title, watch } = entry;
  if (title.type === "movie") return title.runtimeMinutes;
  if (title.runtimeMinutes == null) return null;
  if (watch.seasonNumbers == null) {
    const episodes = title.seasons.reduce((sum, season) => sum + season.episodeCount, 0);
    return episodes > 0 ? title.runtimeMinutes * episodes : title.runtimeMinutes;
  }
  const wanted = new Set(watch.seasonNumbers);
  const episodes = title.seasons
    .filter((season) => wanted.has(season.seasonNumber))
    .reduce((sum, season) => sum + season.episodeCount, 0);
  return episodes > 0 ? title.runtimeMinutes * episodes : title.runtimeMinutes;
}

export function totalMinutes(entries: Entry[]): number {
  return entries.reduce((sum, entry) => sum + (watchMinutes(entry) ?? 0), 0);
}

export function monthlyCounts(
  entries: Entry[],
  months = 12,
  now = new Date(),
): { key: string; label: string; count: number }[] {
  const buckets: { key: string; label: string; count: number }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: date.toLocaleString("en", { month: "short" }), count: 0 });
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    const bucket = byKey.get(watchedOn.slice(0, 7));
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

export function watchYear(entry: Entry): string {
  return entry.watch.watchedOn?.slice(0, 4) ?? "";
}

export function yearsPresent(entries: Entry[]): string[] {
  return [...new Set(entries.map(watchYear).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

export function yearEntries(entries: Entry[], year: string): Entry[] {
  return entries.filter((entry) => watchYear(entry) === year);
}

export function monthsForYear(
  entries: Entry[],
  year: string,
): { key: string; label: string; count: number }[] {
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Number(year), index, 1);
    return {
      key: `${year}-${String(index + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en", { month: "short" }),
      count: 0,
    };
  });

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    const bucket = byKey.get(watchedOn.slice(0, 7));
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface HeatmapWeek {
  days: (HeatmapDay | null)[];
  monthLabel: string | null;
}

export function activityHeatmap(
  entries: Entry[],
  weeks = 53,
  now = new Date(),
): { weeks: HeatmapWeek[]; activeDays: number; max: number } {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    counts.set(watchedOn, (counts.get(watchedOn) ?? 0) + 1);
  }

  const currentWeekStart = startOfWeek(now);
  const grid: HeatmapWeek[] = [];
  let activeDays = 0;
  let max = 0;
  let previousMonth = -1;

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - index * 7);
    const days: (HeatmapDay | null)[] = [];

    for (let day = 0; day < 7; day += 1) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + day);
      if (date > now) {
        days.push(null);
        continue;
      }
      const key = localDateString(date);
      const count = counts.get(key) ?? 0;
      if (count > 0) {
        activeDays += 1;
        max = Math.max(max, count);
      }
      days.push({ date: key, count });
    }

    const month = weekStart.getMonth();
    const monthLabel =
      month !== previousMonth ? weekStart.toLocaleString("en", { month: "short" }) : null;
    previousMonth = month;
    grid.push({ days, monthLabel });
  }

  return { weeks: grid, activeDays, max };
}

export function weekdayCounts(entries: Entry[]): { day: string; count: number }[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    const date = new Date(`${watchedOn}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    counts[(date.getDay() + 6) % 7] += 1;
  }

  return labels.map((day, index) => ({ day, count: counts[index] }));
}

export function watchStreaks(
  entries: Entry[],
  now = new Date(),
): { current: number; longest: number } {
  const weekKeys = new Set<string>();

  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    const date = new Date(`${watchedOn}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    weekKeys.add(localDateString(startOfWeek(date)));
  }

  if (!weekKeys.size) return { current: 0, longest: 0 };

  const sorted = [...weekKeys].sort();
  let longest = 1;
  let run = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00`);
    previous.setDate(previous.getDate() + 7);
    if (localDateString(previous) === sorted[index]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const currentWeek = localDateString(startOfWeek(now));
  const previousWeekDate = startOfWeek(now);
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const previousWeek = localDateString(previousWeekDate);
  let cursor: string | null = weekKeys.has(currentWeek)
    ? currentWeek
    : weekKeys.has(previousWeek)
      ? previousWeek
      : null;
  let current = 0;

  while (cursor && weekKeys.has(cursor)) {
    current += 1;
    const date = new Date(`${cursor}T00:00:00`);
    date.setDate(date.getDate() - 7);
    cursor = localDateString(date);
  }

  return { current, longest };
}

function dayNumber(dateOnly: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
}

export interface QueueStats {
  sampleSize: number;
  medianLagDays: number | null;
  oldestWaitingDays: number | null;
  oldestWaitingKey: string | null;
  finished: number;
  dropped: number;
  watching: number;
  queued: number;
  abandonedShare: number | null;
}

export function queueStats(items: ListItem[], entries: Entry[], now = new Date()): QueueStats {
  const watchDays = new Map<string, number[]>();

  for (const entry of entries) {
    const day = entry.watch.watchedOn ? dayNumber(entry.watch.watchedOn) : null;
    if (day == null) continue;
    const days = watchDays.get(entry.watch.titleKey) ?? [];
    days.push(day);
    watchDays.set(entry.watch.titleKey, days);
  }
  for (const days of watchDays.values()) days.sort((a, b) => a - b);

  const lags: number[] = [];
  let oldestWaitingDays: number | null = null;
  let oldestWaitingKey: string | null = null;
  let finished = 0;
  let dropped = 0;
  let watching = 0;
  let queued = 0;

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const createdDay = dayNumber(localDateString(created));
    if (createdDay == null) continue;
    const days = watchDays.get(item.titleKey);

    if (days) {
      const watchedDay = days.find((day) => day >= createdDay);
      if (watchedDay != null) lags.push(watchedDay - createdDay);
    }

    if (item.status === "done") {
      finished += 1;
    } else if (item.status === "dropped") {
      dropped += 1;
    } else {
      if (item.status === "watching") {
        watching += 1;
      } else {
        queued += 1;
        const waiting = (now.getTime() - created.getTime()) / 86400000;
        if (oldestWaitingDays == null || waiting > oldestWaitingDays) {
          oldestWaitingDays = waiting;
          oldestWaitingKey = item.titleKey;
        }
      }
    }
  }

  lags.sort((a, b) => a - b);
  const median = lags.length
    ? lags.length % 2 === 1
      ? lags[Math.floor(lags.length / 2)]
      : (lags[lags.length / 2 - 1] + lags[lags.length / 2]) / 2
    : null;
  const terminal = finished + dropped;

  return {
    sampleSize: lags.length,
    medianLagDays: median == null ? null : Math.round(median),
    oldestWaitingDays: oldestWaitingDays == null ? null : Math.round(oldestWaitingDays),
    oldestWaitingKey,
    finished,
    dropped,
    watching,
    queued,
    abandonedShare: terminal ? round1((dropped / terminal) * 100) : null,
  };
}

export function decadeCounts(entries: Entry[]): { decade: string; count: number }[] {
  const buckets = new Map<string, number>();

  for (const entry of entries) {
    const year = Number.parseInt(entry.title.year ?? "", 10);
    if (!Number.isFinite(year)) continue;
    const decade = `${Math.floor(year / 10) * 10}s`;
    buckets.set(decade, (buckets.get(decade) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count || a.decade.localeCompare(b.decade));
}

export interface PickStat {
  personId: string;
  count: number;
  avg: number | null;
}

export function pickStats(
  entries: Entry[],
  people: Person[],
): { rows: PickStat[]; unassigned: number } {
  const buckets = new Map<string, { count: number; scores: number[] }>();
  let unassigned = 0;

  for (const entry of entries) {
    const pickedBy = entry.watch.pickedBy;
    if (!pickedBy || !people.some((person) => person.id === pickedBy)) {
      unassigned += 1;
      continue;
    }
    const bucket = buckets.get(pickedBy) ?? { count: 0, scores: [] };
    bucket.count += 1;
    if (entry.combined != null) bucket.scores.push(entry.combined);
    buckets.set(pickedBy, bucket);
  }

  const rows = people.map((person) => {
    const bucket = buckets.get(person.id);
    return {
      personId: person.id,
      count: bucket?.count ?? 0,
      avg: bucket && bucket.scores.length ? round1(mean(bucket.scores)) : null,
    };
  });

  return { rows, unassigned };
}

export interface GenreGap {
  name: string;
  count: number;
  avgA: number;
  avgB: number;
  gap: number;
}

export function genreGapStats(
  entries: Entry[],
  personA: string,
  personB: string,
  limit = 8,
): GenreGap[] {
  const buckets = new Map<string, { a: number[]; b: number[] }>();

  for (const entry of entries) {
    const a = entry.scores[personA];
    const b = entry.scores[personB];
    if (a === undefined || b === undefined) continue;
    for (const genre of new Set(entry.title.genres)) {
      const bucket = buckets.get(genre) ?? { a: [], b: [] };
      bucket.a.push(a);
      bucket.b.push(b);
      buckets.set(genre, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([name, bucket]) => {
      const avgA = round1(mean(bucket.a));
      const avgB = round1(mean(bucket.b));
      return { name, count: bucket.a.length, avgA, avgB, gap: round1(avgA - avgB) };
    })
    .sort((x, y) => y.count - x.count || Math.abs(y.gap) - Math.abs(x.gap))
    .slice(0, limit);
}

export interface LanguageStat {
  language: string;
  count: number;
}

export function languageStats(entries: Entry[]): {
  rows: LanguageStat[];
  known: number;
  unknown: number;
  foreignShare: number | null;
} {
  const buckets = new Map<string, number>();
  let known = 0;
  let unknown = 0;
  let foreign = 0;

  for (const entry of entries) {
    const language = entry.title.originalLanguage;
    if (!language) {
      unknown += 1;
      continue;
    }
    known += 1;
    if (language !== "en") foreign += 1;
    buckets.set(language, (buckets.get(language) ?? 0) + 1);
  }

  return {
    rows: [...buckets.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count),
    known,
    unknown,
    foreignShare: known ? round1((foreign / known) * 100) : null,
  };
}

export function decadeStats(
  entries: Entry[],
  scorer: Scorer,
): { decade: string; count: number; avg: number | null }[] {
  const buckets = new Map<string, { count: number; scores: number[] }>();

  for (const entry of entries) {
    const year = Number.parseInt(entry.title.year ?? "", 10);
    if (!Number.isFinite(year)) continue;
    const decade = `${Math.floor(year / 10) * 10}s`;
    const bucket = buckets.get(decade) ?? { count: 0, scores: [] };
    bucket.count += 1;
    const score = scorer(entry);
    if (score != null) bucket.scores.push(score);
    buckets.set(decade, bucket);
  }

  return [...buckets.entries()]
    .map(([decade, bucket]) => ({
      decade,
      count: bucket.count,
      avg: bucket.scores.length ? round1(mean(bucket.scores)) : null,
    }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
}

export interface RuntimePoint {
  runtime: number;
  score: number;
  name: string;
}

export function runtimePoints(entries: Entry[], scorer: Scorer): RuntimePoint[] {
  const points: RuntimePoint[] = [];

  for (const entry of entries) {
    if (entry.title.type !== "movie" || entry.title.runtimeMinutes == null) continue;
    const score = scorer(entry);
    if (score == null) continue;
    points.push({ runtime: entry.title.runtimeMinutes, score, name: entry.title.name });
  }

  return points;
}

export interface RewatchStats {
  rewatchedTitles: number;
  totalTitles: number;
  rate: number | null;
  comfort: { name: string; count: number; avg: number | null }[];
}

export function rewatchStats(entries: Entry[]): RewatchStats {
  const buckets = new Map<string, { name: string; count: number; scores: number[] }>();

  for (const entry of entries) {
    const bucketKey = `${entry.watch.titleKey}:${entry.watch.seasonNumbers?.join("+") ?? "all"}`;
    const bucket = buckets.get(bucketKey) ?? {
      name:
        entry.title.type === "tv"
          ? `${entry.title.name} · ${seasonLabel(entry)}`
          : entry.title.name,
      count: 0,
      scores: [],
    };
    bucket.count += 1;
    if (entry.combined != null) bucket.scores.push(entry.combined);
    buckets.set(bucketKey, bucket);
  }

  const comfort = [...buckets.values()]
    .filter((bucket) => bucket.count >= 2)
    .map((bucket) => ({
      name: bucket.name,
      count: bucket.count,
      avg: bucket.scores.length ? round1(mean(bucket.scores)) : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0));

  const totalTitles = buckets.size;
  return {
    rewatchedTitles: comfort.length,
    totalTitles,
    rate: totalTitles ? round1((comfort.length / totalTitles) * 100) : null,
    comfort: comfort.slice(0, 3),
  };
}

export function compareMonthly(
  entries: Entry[],
  people: Person[],
  buckets: { key: string; label: string }[],
): { key: string; label: string; joint: number; a: number; b: number }[] {
  const rows = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    joint: 0,
    a: 0,
    b: 0,
  }));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const [first, second] = people;

  for (const entry of entries) {
    const watchedOn = entry.watch.watchedOn;
    if (!watchedOn) continue;
    const bucket = byKey.get(watchedOn.slice(0, 7));
    if (!bucket) continue;
    if (entry.watch.watchers.length > 1) bucket.joint += 1;
    else if (first && entry.watch.watchers[0] === first.id) bucket.a += 1;
    else if (second && entry.watch.watchers[0] === second.id) bucket.b += 1;
  }

  return rows;
}

export interface Insight {
  id: string;
  text: string;
}

export function buildInsights(entries: Entry[], people: Person[], now = new Date()): Insight[] {
  const insights: Insight[] = [];
  const joint = jointEntries(entries);
  const pair = people.length >= 2 ? { a: people[0], b: people[1] } : null;

  const pickedEntries = entries.filter((entry) => entry.watch.pickedBy);
  if (pickedEntries.length >= 3) {
    const firstPicked = pickedEntries[0].watch.pickedBy;
    const firstChange = pickedEntries.findIndex((entry) => entry.watch.pickedBy !== firstPicked);
    const runLength = firstChange === -1 ? pickedEntries.length : firstChange;
    const picker = people.find((person) => person.id === firstPicked);
    if (picker && runLength >= 3) {
      insights.push({ id: "pick-streak", text: `${picker.name} picked the last ${runLength}` });
    }
  }

  if (pair) {
    const picks = pickStats(entries, people);
    const firstPicks = picks.rows.find((row) => row.personId === pair.a.id);
    const secondPicks = picks.rows.find((row) => row.personId === pair.b.id);
    if (
      firstPicks?.avg != null &&
      secondPicks?.avg != null &&
      firstPicks.count >= 2 &&
      secondPicks.count >= 2
    ) {
      const better = firstPicks.avg >= secondPicks.avg ? pair.a : pair.b;
      const diff = round1(Math.abs(firstPicks.avg - secondPicks.avg));
      if (diff >= 0.3) {
        insights.push({
          id: "picks",
          text: `${better.name}'s picks rate ${diff} higher on average`,
        });
      }
    }

    const firstStats = scoreStats(entries, makeScorer(pair.a.id));
    const secondStats = scoreStats(entries, makeScorer(pair.b.id));
    if (
      firstStats.avg != null &&
      secondStats.avg != null &&
      firstStats.count >= 3 &&
      secondStats.count >= 3
    ) {
      const diff = round1(Math.abs(firstStats.avg - secondStats.avg));
      if (diff >= 0.5) {
        const higher = firstStats.avg > secondStats.avg ? pair.a : pair.b;
        insights.push({
          id: "harshness",
          text: `${higher.name} rates about ${diff} higher on average`,
        });
      }
    }

    for (const person of people) {
      const solo = scoreStats(soloEntries(entries, person.id), makeScorer(person.id));
      const together = scoreStats(joint, makeScorer(person.id));
      if (solo.avg != null && together.avg != null && solo.count >= 3 && together.count >= 3) {
        const diff = round1(Math.abs(solo.avg - together.avg));
        if (diff >= 0.4) {
          insights.push({
            id: `mode-${person.id}`,
            text: `${person.name} rates ${diff} ${solo.avg > together.avg ? "higher" : "lower"} when watching alone`,
          });
        }
      }
    }

    const duels = genreGapStats(joint, pair.a.id, pair.b.id, 8).filter((row) => row.count >= 2);
    if (duels.length) {
      const mostSplit = [...duels].sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap))[0];
      const mostAgreed = [...duels].sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap))[0];
      if (Math.abs(mostSplit.gap) >= 1.5) {
        insights.push({
          id: "split",
          text: `${mostSplit.name} splits you most (${round1(Math.abs(mostSplit.gap))} apart)`,
        });
      }
      if (Math.abs(mostAgreed.gap) <= 0.6) {
        insights.push({
          id: "agree",
          text: `${mostAgreed.name} is where you agree most (${round1(Math.abs(mostAgreed.gap))} apart)`,
        });
      }
    }
  }

  const streaks = watchStreaks(joint, now);
  if (streaks.current >= 3) {
    insights.push({
      id: "streak",
      text: `You've watched together ${streaks.current} weeks in a row`,
    });
  }

  const concentrationBase = joint.length >= 8 ? joint : entries;
  if (concentrationBase.length >= 8) {
    const top = genreStats(concentrationBase, makeScorer(), 1)[0];
    if (top) {
      const share = Math.round((top.count / concentrationBase.length) * 100);
      if (share >= 40) {
        insights.push({
          id: "concentration",
          text: `${top.name} makes up ${share}% of recent watches`,
        });
      }
    }
  }

  if (pair) {
    const deltas = people
      .map((person) => {
        const imdb = criticComparison(entries, makeScorer(person.id)).find(
          (row) => row.source === "IMDb",
        );
        return imdb ? { person, delta: Math.abs(imdb.delta) } : null;
      })
      .filter((row): row is { person: Person; delta: number } => row !== null);
    if (deltas.length === 2 && Math.abs(deltas[0].delta - deltas[1].delta) >= 0.4) {
      const closer = deltas[0].delta <= deltas[1].delta ? deltas[0] : deltas[1];
      insights.push({
        id: "critics",
        text: `${closer.person.name} tracks IMDb closer (±${closer.delta})`,
      });
    }
  }

  return insights.slice(0, 5);
}

export function seasonLabel(entry: Pick<Entry, "watch" | "title">): string {
  if (entry.title.type !== "tv") return "";
  const seasons = entry.watch.seasonNumbers;
  if (!seasons || !seasons.length) return "All seasons";
  if (seasons.length === 1) return `S${seasons[0]}`;
  const sorted = [...seasons].sort((a, b) => a - b);
  const contiguous = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  if (contiguous) return `S${sorted[0]}–S${sorted[sorted.length - 1]}`;
  const head = sorted.slice(0, 4).map((value) => `S${value}`);
  return sorted.length > 4 ? `${head.join(", ")}…` : head.join(", ");
}

export function isJoint(entry: Entry): boolean {
  return entry.watch.watchers.length > 1;
}

export function jointEntries(entries: Entry[]): Entry[] {
  return entries.filter(isJoint);
}

export function soloEntries(entries: Entry[], personId: string): Entry[] {
  return entries.filter(
    (entry) => entry.watch.watchers.length === 1 && entry.watch.watchers[0] === personId,
  );
}

export function ratingDistribution(
  entries: Entry[],
  scorer: Scorer,
): { score: number; count: number }[] {
  const counts = new Map<number, number>();
  for (let score = 1; score <= 10; score += 1) counts.set(score, 0);

  for (const entry of entries) {
    const score = scorer(entry);
    if (score == null) continue;
    const bucket = Math.round(score);
    if (bucket < 1 || bucket > 10) continue;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()].map(([score, count]) => ({ score, count }));
}

const PRIOR_WEIGHT = 2;
const DEFAULT_PRIOR = 6.5;

interface Affinity {
  sum: number;
  count: number;
}

interface Signal {
  value: number;
  weight: number;
}

export interface TasteProfile {
  personId: string;
  mean: number;
  count: number;
  genres: Map<string, Affinity>;
  directors: Map<string, Affinity>;
  actors: Map<string, Affinity>;
  types: Map<string, Affinity>;
}

function addAffinity(map: Map<string, Affinity>, key: string, score: number) {
  const bucket = map.get(key) ?? { sum: 0, count: 0 };
  bucket.sum += score;
  bucket.count += 1;
  map.set(key, bucket);
}

function signalFromCounts(sum: number, count: number, prior: number): Signal | null {
  if (count <= 0) return null;
  return {
    value: (sum + prior * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT),
    weight: count / (count + PRIOR_WEIGHT),
  };
}

function smoothedAffinity(map: Map<string, Affinity>, key: string, prior: number): Signal | null {
  const bucket = map.get(key);
  if (!bucket) return null;
  return signalFromCounts(bucket.sum, bucket.count, prior);
}

function isSignal(signal: Signal | null): signal is Signal {
  return signal !== null;
}

type AffinityFamily = "genres" | "directors" | "actors" | "types";

interface Holdout {
  mean: number;
  deltas: Record<AffinityFamily, Map<string, { sum: number; count: number }>>;
}

function resolveSignal(
  profile: TasteProfile,
  family: AffinityFamily,
  key: string,
  holdout?: Holdout,
): Signal | null {
  const bucket = profile[family].get(key);
  const delta = holdout?.deltas[family].get(key);
  if (!bucket && !delta) return null;

  const sum = (bucket?.sum ?? 0) - (delta?.sum ?? 0);
  const count = (bucket?.count ?? 0) - (delta?.count ?? 0);
  return signalFromCounts(sum, count, holdout ? holdout.mean : profile.mean);
}

function predictFromProfile(
  profile: TasteProfile,
  title: Pick<Title, "genres" | "directors" | "cast" | "type">,
  holdout?: Holdout,
): Prediction {
  const groups: { weight: number; signals: Signal[] }[] = [
    {
      weight: 0.45,
      signals: title.genres
        .map((genre) => resolveSignal(profile, "genres", genre, holdout))
        .filter(isSignal),
    },
    {
      weight: 0.25,
      signals: title.cast
        .slice(0, 3)
        .map((actor) => resolveSignal(profile, "actors", actor, holdout))
        .filter(isSignal),
    },
    {
      weight: 0.2,
      signals: title.directors
        .map((director) => resolveSignal(profile, "directors", director, holdout))
        .filter(isSignal),
    },
    {
      weight: 0.1,
      signals: [resolveSignal(profile, "types", title.type, holdout)].filter(isSignal),
    },
  ];

  let weightedSum = 0;
  let weightSum = 0;
  let dataWeight = 0;

  for (const group of groups) {
    if (!group.signals.length) continue;
    const groupWeight = group.signals.reduce((sum, signal) => sum + signal.weight, 0);
    const groupValue =
      group.signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0) / groupWeight;
    weightedSum += groupValue * group.weight;
    weightSum += group.weight;
    dataWeight += group.weight;
  }

  const mean = holdout ? holdout.mean : profile.mean;
  if (weightSum === 0) return { score: mean, confidence: 0 };

  const score = Math.max(1, Math.min(10, weightedSum / weightSum));
  const count = holdout ? Math.max(0, profile.count - 1) : profile.count;
  return {
    score: round1(score),
    confidence: round2(dataWeight * Math.min(1, count / 10)),
  };
}

export function predictScore(
  profile: TasteProfile,
  title: Pick<Title, "genres" | "directors" | "cast" | "type">,
): Prediction {
  return predictFromProfile(profile, title);
}

export function buildTasteProfile(entries: Entry[], personId: string): TasteProfile {
  const profile: TasteProfile = {
    personId,
    mean: DEFAULT_PRIOR,
    count: 0,
    genres: new Map(),
    directors: new Map(),
    actors: new Map(),
    types: new Map(),
  };

  let sum = 0;

  for (const entry of entries) {
    const score = entry.scores[personId];
    if (score == null) continue;
    profile.count += 1;
    sum += score;
    for (const genre of entry.title.genres) addAffinity(profile.genres, genre, score);
    for (const director of entry.title.directors) addAffinity(profile.directors, director, score);
    for (const actor of entry.title.cast) addAffinity(profile.actors, actor, score);
    addAffinity(profile.types, entry.title.type, score);
  }

  if (profile.count) profile.mean = round1(sum / profile.count);
  return profile;
}

export interface Prediction {
  score: number;
  confidence: number;
}

export function topGenreOverlap(
  profile: TasteProfile,
  title: Pick<Title, "genres">,
): string | null {
  const scored = title.genres
    .map((genre) => ({ genre, signal: smoothedAffinity(profile.genres, genre, profile.mean) }))
    .filter((row): row is { genre: string; signal: Signal } => row.signal !== null)
    .filter((row) => row.signal.value > profile.mean);
  if (!scored.length) return null;
  scored.sort((a, b) => b.signal.value - a.signal.value);
  return scored[0].genre;
}

export function genreAffinity(profile: TasteProfile, genre: string): number | null {
  const signal = smoothedAffinity(profile.genres, genre, profile.mean);
  return signal ? round1(signal.value) : null;
}

export function predictSummaryScore(
  profile: TasteProfile,
  summary: { type: MediaType; genreNames?: string[] },
): number {
  return round1(
    predictScore(profile, {
      genres: summary.genreNames ?? [],
      directors: [],
      cast: [],
      type: summary.type,
    }).score,
  );
}

export function safeSummaryScore(
  profiles: TasteProfile[],
  summary: { type: MediaType; genreNames?: string[] },
): number | null {
  if (!profiles.length) return null;
  return Math.min(...profiles.map((profile) => predictSummaryScore(profile, summary)));
}

export interface PickSuggestion {
  title: Title;
  predictions: { personId: string; score: number; confidence: number }[];
  safeScore: number;
  averageScore: number;
}

export function rankPicks(titles: Title[], profiles: TasteProfile[]): PickSuggestion[] {
  if (!profiles.length) return [];

  return titles
    .map((title) => {
      const predictions = profiles.map((profile) => ({
        personId: profile.personId,
        ...predictScore(profile, title),
      }));
      const scores = predictions.map((prediction) => prediction.score);
      return {
        title,
        predictions,
        safeScore: round1(Math.min(...scores)),
        averageScore: round1(mean(scores)),
      };
    })
    .sort((a, b) => b.safeScore - a.safeScore || b.averageScore - a.averageScore);
}

export interface PredictionAccuracy {
  personId: string;
  count: number;
  meanAbsoluteError: number | null;
}

function holdoutDeltas(keys: string[], score: number): Map<string, { sum: number; count: number }> {
  const deltas = new Map<string, { sum: number; count: number }>();

  for (const key of keys) {
    const bucket = deltas.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += score;
    bucket.count += 1;
    deltas.set(key, bucket);
  }

  return deltas;
}

export function predictionAccuracy(entries: Entry[], personId: string): PredictionAccuracy {
  const rated = entries.filter((entry) => entry.scores[personId] != null);
  if (rated.length < 5) return { personId, count: rated.length, meanAbsoluteError: null };

  const profile = buildTasteProfile(entries, personId);
  const totalSum = rated.reduce((sum, entry) => sum + (entry.scores[personId] as number), 0);
  const errors: number[] = [];

  for (const entry of rated) {
    const score = entry.scores[personId] as number;
    const meanOthers =
      profile.count > 1 ? round1((totalSum - score) / (profile.count - 1)) : profile.mean;

    const holdout: Holdout = {
      mean: meanOthers,
      deltas: {
        genres: holdoutDeltas(entry.title.genres, score),
        directors: holdoutDeltas(entry.title.directors, score),
        actors: holdoutDeltas(entry.title.cast, score),
        types: holdoutDeltas([entry.title.type], score),
      },
    };

    const prediction = predictFromProfile(profile, entry.title, holdout);
    errors.push(Math.abs(prediction.score - score));
  }

  return { personId, count: rated.length, meanAbsoluteError: round2(mean(errors)) };
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  if (dayHours && rest) return `${days}d ${dayHours}h ${rest}m`;
  if (dayHours) return `${days}d ${dayHours}h`;
  if (rest) return `${days}d ${rest}m`;
  return `${days}d`;
}
