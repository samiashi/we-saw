import { describe, expect, it } from "vitest";
import {
  activityHeatmap,
  buildEntries,
  buildInsights,
  buildTasteProfile,
  compareMonthly,
  compatibility,
  criticComparison,
  decadeCounts,
  decadeStats,
  divergences,
  formatMinutes,
  genreAffinity,
  genreGapStats,
  genreStats,
  isJoint,
  jointEntries,
  languageStats,
  makeScorer,
  monthsForYear,
  monthlyCounts,
  pickStats,
  predictScore,
  predictSummaryScore,
  predictionAccuracy,
  queueStats,
  rankPicks,
  ratingDistribution,
  rewatchStats,
  soloEntries,
  totalMinutes,
  watchMinutes,
  watchStreaks,
  weekdayCounts,
  yearEntries,
  yearsPresent,
} from "@/lib/analytics";
import type { Entry, ListItem, Rating, Title, Watch } from "@/lib/types";

function title(overrides: Partial<Title> & Pick<Title, "key" | "name">): Title {
  return {
    tmdbId: null,
    imdbId: null,
    type: "movie",
    year: "2010",
    posterPath: null,
    overview: "",
    genres: [],
    directors: [],
    cast: [],
    runtimeMinutes: 100,
    seasons: [],
    critic: null,
    addedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as Title;
}

function watch(overrides: Partial<Watch> & Pick<Watch, "id" | "titleKey">): Watch {
  return {
    seasonNumber: null,
    watchedOn: "2024-05-01",
    note: "",
    watchers: ["a", "b"],
    createdBy: null,
    createdAt: "2024-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function rating(watchId: string, userId: string, score: number): Rating {
  return { watchId, userId, score, updatedAt: "2024-05-01T00:00:00.000Z" };
}

const titles: Title[] = [
  title({
    key: "movie:1",
    name: "Alpha",
    genres: ["Drama", "Comedy"],
    directors: ["Dir One"],
    cast: ["Actor A", "Actor B"],
    year: "1999",
  }),
  title({
    key: "movie:2",
    name: "Beta",
    genres: ["Drama"],
    directors: ["Dir One"],
    cast: ["Actor A"],
    year: "2011",
  }),
  title({
    key: "tv:3",
    name: "Gamma",
    type: "tv",
    genres: ["Comedy"],
    directors: ["Dir Two"],
    cast: ["Actor C"],
    year: "2005",
    runtimeMinutes: 30,
    seasons: [{ seasonNumber: 1, name: "Season 1", episodeCount: 10, year: "2005" }],
  }),
];

const watches: Watch[] = [
  watch({ id: "w1", titleKey: "movie:1" }),
  watch({ id: "w2", titleKey: "movie:2", watchedOn: "2024-06-15" }),
  watch({ id: "w3", titleKey: "tv:3", seasonNumber: 1, watchedOn: "2024-06-20" }),
];

const ratings: Rating[] = [
  rating("w1", "a", 8),
  rating("w1", "b", 4),
  rating("w2", "a", 6),
  rating("w3", "a", 10),
  rating("w3", "b", 9),
];

const entries: Entry[] = buildEntries(titles, watches, ratings);

describe("buildEntries", () => {
  it("combines scores and computes gaps", () => {
    const w1 = entries.find((entry) => entry.watch.id === "w1");
    expect(w1?.combined).toBe(6);
    expect(w1?.gap).toBe(4);
  });

  it("sorts newest first", () => {
    expect(entries.map((entry) => entry.watch.id)).toEqual(["w3", "w2", "w1"]);
  });
});

describe("genreStats", () => {
  it("counts entries per genre with average combined score", () => {
    const rows = genreStats(entries, makeScorer());
    const drama = rows.find((row) => row.name === "Drama");
    expect(drama?.count).toBe(2);
    expect(drama?.avg).toBe(6);
  });

  it("supports per-person scoring", () => {
    const rows = genreStats(entries, makeScorer("a"));
    const comedy = rows.find((row) => row.name === "Comedy");
    expect(comedy?.count).toBe(2);
    expect(comedy?.avg).toBe(9);
  });
});

describe("compatibility", () => {
  it("computes average gap and close share", () => {
    const stats = compatibility(entries, "a", "b");
    expect(stats.sharedCount).toBe(2);
    expect(stats.avgGap).toBe(2.5);
    expect(stats.closeShare).toBe(50);
    expect(stats.correlation).toBeNull();
  });

  it("reports correlation once three shared ratings exist", () => {
    const shared = buildEntries([titles[0], titles[1], titles[2]], watches, [
      rating("w1", "a", 2),
      rating("w1", "b", 3),
      rating("w2", "a", 4),
      rating("w2", "b", 5),
      rating("w3", "a", 6),
      rating("w3", "b", 7),
    ]);
    expect(compatibility(shared, "a", "b").correlation).toBeCloseTo(1, 5);
  });

  it("ranks the biggest disagreements", () => {
    const rows = divergences(entries, "a", "b");
    expect(rows[0].entry.watch.id).toBe("w1");
    expect(rows[0].gap).toBe(4);
  });
});

describe("watch time", () => {
  it("multiplies season runtime by episode count", () => {
    const w3 = entries.find((entry) => entry.watch.id === "w3");
    expect(w3 && watchMinutes(w3)).toBe(300);
  });

  it("totals across entries and formats", () => {
    expect(totalMinutes(entries)).toBe(500);
    expect(formatMinutes(500)).toBe("8h 20m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(1500)).toBe("1d 1h");
  });
});

describe("monthly and decade buckets", () => {
  it("buckets watches into rolling months", () => {
    const months = monthlyCounts(entries, 3, new Date(2024, 5, 30));
    expect(months.map((month) => month.key)).toEqual(["2024-04", "2024-05", "2024-06"]);
    expect(months.map((month) => month.count)).toEqual([0, 1, 2]);
  });

  it("filters and buckets by watch year", () => {
    expect(yearsPresent(entries)).toEqual(["2024"]);
    expect(yearEntries(entries, "2024")).toHaveLength(3);
    expect(yearEntries(entries, "2023")).toHaveLength(0);

    const months = monthsForYear(entries, "2024");
    expect(months).toHaveLength(12);
    expect(months[4].count).toBe(1);
    expect(months[5].count).toBe(2);
  });

  it("groups by release decade", () => {
    const decades = decadeCounts(entries);
    expect(decades).toContainEqual({ decade: "1990s", count: 1 });
    expect(decades).toContainEqual({ decade: "2000s", count: 1 });
    expect(decades).toContainEqual({ decade: "2010s", count: 1 });
  });
});

describe("activity and queue analytics", () => {
  const now = new Date(2026, 8, 21);
  const gridNow = new Date(2026, 8, 28);
  const activityEntries = buildEntries(
    titles,
    [
      watch({ id: "a1", titleKey: "movie:1", watchedOn: "2026-09-21" }),
      watch({ id: "a2", titleKey: "movie:2", watchedOn: "2026-09-26" }),
      watch({ id: "a3", titleKey: "tv:3", seasonNumber: 1, watchedOn: "2026-09-14" }),
      watch({ id: "a4", titleKey: "movie:1", watchedOn: "2026-09-07" }),
    ],
    [
      rating("a1", "a", 8),
      rating("a2", "a", 7),
      rating("a3", "a", 9),
      rating("a3", "b", 8),
      rating("a4", "a", 6),
    ],
  );

  it("builds a 53-week heatmap with active days", () => {
    const heatmap = activityHeatmap(activityEntries, 53, gridNow);
    expect(heatmap.weeks).toHaveLength(53);
    expect(heatmap.activeDays).toBe(4);
    expect(heatmap.max).toBe(1);

    const days = heatmap.weeks.flatMap((week) => week.days);
    expect(days.some((day) => day?.date === "2026-09-21" && day.count === 1)).toBe(true);
    expect(days.filter((day) => day === null)).toHaveLength(6);
  });

  it("counts watches by weekday", () => {
    const weekdays = weekdayCounts(activityEntries);
    expect(weekdays[0]).toEqual({ day: "Mon", count: 3 });
    expect(weekdays[5]).toEqual({ day: "Sat", count: 1 });
    expect(weekdays[6]).toEqual({ day: "Sun", count: 0 });
  });

  it("measures week streaks", () => {
    const streaks = watchStreaks(activityEntries, gridNow);
    expect(streaks.current).toBe(3);
    expect(streaks.longest).toBe(3);

    expect(watchStreaks([], gridNow)).toEqual({ current: 0, longest: 0 });
    const gap = watchStreaks([activityEntries.find((entry) => entry.watch.id === "a4")!], gridNow);
    expect(gap.current).toBe(0);
    expect(gap.longest).toBe(1);
  });

  it("summarizes queue health", () => {
    const items: ListItem[] = [
      {
        id: "q1",
        titleKey: "movie:1",
        status: "done",
        addedBy: "a",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
      {
        id: "q2",
        titleKey: "movie:99",
        status: "dropped",
        addedBy: "a",
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      },
      {
        id: "q3",
        titleKey: "tv:3",
        status: "queued",
        addedBy: "b",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ];

    const stats = queueStats(items, activityEntries, now);
    expect(stats.finished).toBe(1);
    expect(stats.dropped).toBe(1);
    expect(stats.queued).toBe(1);
    expect(stats.abandonedShare).toBe(50);
    expect(stats.medianLagDays).toBe(37);
    expect(stats.oldestWaitingDays).toBe(20);
    expect(stats.oldestWaitingKey).toBe("tv:3");
  });
});

describe("picks, duels and taste depth", () => {
  const people = [
    { id: "a", name: "Sam" },
    { id: "b", name: "Noor" },
  ];
  const depthTitles = [
    title({
      key: "movie:100",
      name: "English One",
      genres: ["Drama"],
      year: "1994",
      originalLanguage: "en",
    }),
    title({
      key: "movie:101",
      name: "Korean One",
      genres: ["Drama", "Thriller"],
      year: "2019",
      originalLanguage: "ko",
    }),
    title({
      key: "movie:102",
      name: "Spanish One",
      genres: ["Thriller"],
      year: "2006",
      originalLanguage: "es",
    }),
  ];
  const depthWatches = [
    watch({ id: "d1", titleKey: "movie:100", watchedOn: "2026-01-05" }),
    watch({ id: "d2", titleKey: "movie:101", watchedOn: "2026-02-05" }),
    watch({ id: "d3", titleKey: "movie:102", watchedOn: "2026-03-05" }),
    watch({ id: "d4", titleKey: "movie:100", watchedOn: "2026-04-05" }),
  ];
  const depthRatings = [
    rating("d1", "a", 9),
    rating("d1", "b", 6),
    rating("d2", "a", 8),
    rating("d2", "b", 9),
    rating("d3", "a", 7),
    rating("d3", "b", 8),
    rating("d4", "a", 9),
    rating("d4", "b", 7),
  ];
  const depthEntries = buildEntries(depthTitles, depthWatches, depthRatings);
  const withPicks = depthEntries.map((entry, index) =>
    index % 2 === 0
      ? { ...entry, watch: { ...entry.watch, pickedBy: "a" } }
      : { ...entry, watch: { ...entry.watch, pickedBy: "b" } },
  );

  it("splits pick credit per person", () => {
    const picks = pickStats(withPicks, people);
    expect(picks.unassigned).toBe(0);
    expect(picks.rows.find((row) => row.personId === "a")?.count).toBe(2);
    expect(picks.rows.find((row) => row.personId === "b")?.count).toBe(2);
    expect(picks.rows.find((row) => row.personId === "a")?.avg).not.toBeNull();
  });

  it("measures per-genre gaps between two people", () => {
    const duels = genreGapStats(depthEntries, "a", "b", 8);
    const drama = duels.find((row) => row.name === "Drama");
    expect(drama?.count).toBe(3);
    expect(drama?.gap).toBe(1.4);
    const thriller = duels.find((row) => row.name === "Thriller");
    expect(thriller?.gap).toBe(-1);
  });

  it("computes language share, era ratings and rewatches", () => {
    const languages = languageStats(depthEntries);
    expect(languages.known).toBe(4);
    expect(languages.unknown).toBe(0);
    expect(languages.rows[0]).toEqual({ language: "en", count: 2 });
    expect(languages.foreignShare).toBe(50);

    const eras = decadeStats(depthEntries, makeScorer());
    expect(eras.map((row) => row.decade)).toEqual(["1990s", "2000s", "2010s"]);

    const rewatches = rewatchStats(depthEntries);
    expect(rewatches.rewatchedTitles).toBe(1);
    expect(rewatches.rate).toBe(33.3);
    expect(rewatches.comfort[0].name).toBe("English One");
    expect(rewatches.comfort[0].count).toBe(2);
  });

  it("splits monthly counts into joint and solo", () => {
    const soloWatch = watch({
      id: "d5",
      titleKey: "movie:102",
      watchedOn: "2026-01-20",
      watchers: ["a"],
    });
    const rows = compareMonthly(
      buildEntries(depthTitles, [soloWatch], [rating("d5", "a", 8)]),
      people,
      [{ key: "2026-01", label: "Jan" }],
    );
    expect(rows[0].a).toBe(1);
    expect(rows[0].joint).toBe(0);
    expect(rows[0].b).toBe(0);
  });

  it("writes plain-language insights", () => {
    const insights = buildInsights(withPicks, people);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((insight) => insight.text.length > 0)).toBe(true);
    expect(insights.some((insight) => insight.id === "harshness")).toBe(true);
  });
});

describe("criticComparison", () => {
  it("normalizes RT percentages to a 10-point scale", () => {
    const withCritic = buildEntries(
      [{ ...titles[0], critic: { imdb: 8.5, rt: 90, metacritic: null, fetchedAt: "2024-01-01" } }],
      [watches[0]],
      [rating("w1", "a", 10)],
    );
    const rows = criticComparison(withCritic, makeScorer("a"));
    const imdb = rows.find((row) => row.source === "IMDb");
    const rt = rows.find((row) => row.source === "RT");
    expect(imdb?.delta).toBe(1.5);
    expect(rt?.criticAvg).toBe(9);
    expect(rows.some((row) => row.source === "Metacritic")).toBe(false);
  });
});

describe("joint and solo scopes", () => {
  const mixed = buildEntries(
    titles,
    [
      watch({ id: "s1", titleKey: "movie:1", watchers: ["a"] }),
      watch({ id: "s2", titleKey: "movie:2", watchers: ["b"] }),
      watch({ id: "s3", titleKey: "tv:3", seasonNumber: 1, watchers: ["a", "b"] }),
    ],
    [rating("s1", "a", 9), rating("s2", "b", 5), rating("s3", "a", 7), rating("s3", "b", 8)],
  );

  it("splits entries into joint and per-person solo", () => {
    expect(jointEntries(mixed).map((entry) => entry.watch.id)).toEqual(["s3"]);
    expect(soloEntries(mixed, "a").map((entry) => entry.watch.id)).toEqual(["s1"]);
    expect(soloEntries(mixed, "b").map((entry) => entry.watch.id)).toEqual(["s2"]);
    expect(mixed.every((entry) => isJoint(entry) === entry.watch.watchers.length > 1)).toBe(true);
  });

  it("scores a person's solo stats from their own ratings only", () => {
    const soloA = soloEntries(mixed, "a");
    expect(genreStats(soloA, makeScorer("a")).find((row) => row.name === "Drama")?.avg).toBe(9);
    const fromB = genreStats(soloA, makeScorer("b"));
    expect(fromB.length).toBeGreaterThan(0);
    expect(fromB.every((row) => row.avg === null)).toBe(true);
  });

  it("builds a 1-10 distribution for a scope", () => {
    const distribution = ratingDistribution(soloEntries(mixed, "a"), makeScorer("a"));
    expect(distribution).toHaveLength(10);
    expect(distribution.find((bucket) => bucket.score === 9)?.count).toBe(1);
    expect(distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });
});

describe("taste engine", () => {
  const sciFiTitles = [0, 1, 2, 3, 4, 5].map((index) =>
    title({
      key: `movie:scifi${index}`,
      name: `Sci-Fi ${index}`,
      genres: ["Science Fiction"],
      cast: ["Actor X"],
      directors: ["Dir X"],
    }),
  );
  const dramaTitle = title({
    key: "movie:drama",
    name: "Quiet Drama",
    genres: ["Drama"],
    cast: ["Actor Y"],
    directors: ["Dir Y"],
  });
  const unknownTitle = title({
    key: "tv:unknown",
    name: "Unknown Show",
    type: "tv",
    genres: ["Documentary"],
    cast: ["Nobody"],
    directors: ["Someone"],
  });
  const sciFiEntries = buildEntries(
    sciFiTitles,
    sciFiTitles.map((entry, index) =>
      watch({ id: `sw${index}`, titleKey: entry.key, watchedOn: "2024-03-01" }),
    ),
    sciFiTitles.map((entry, index) => rating(`sw${index}`, "a", 9)),
  );
  const profile = buildTasteProfile(sciFiEntries, "a");

  it("summarizes a person's scores into a profile", () => {
    expect(profile.count).toBe(6);
    expect(profile.mean).toBe(9);
    expect(profile.genres.get("Science Fiction")?.count).toBe(6);
  });

  it("predicts high for genres they love and flags confidence", () => {
    const loved = predictScore(profile, sciFiTitles[0]);
    expect(loved.score).toBeGreaterThan(8.5);
    expect(loved.confidence).toBeGreaterThan(0.2);

    const unknown = predictScore(profile, unknownTitle);
    expect(unknown.score).toBe(profile.mean);
    expect(unknown.confidence).toBe(0);
  });

  it("exposes smoothed genre affinity for charts", () => {
    expect(genreAffinity(profile, "Science Fiction")).toBe(9);
    expect(genreAffinity(profile, "Documentary")).toBeNull();
  });

  it("predicts from a lightweight discovery summary", () => {
    expect(predictSummaryScore(profile, { type: "movie", genreNames: ["Science Fiction"] })).toBe(
      9,
    );
    expect(predictSummaryScore(profile, { type: "tv", genreNames: [] })).toBe(profile.mean);
  });

  it("ranks picks by the safer minimum score", () => {
    const sciFiLover = buildTasteProfile(sciFiEntries, "a");
    const dramaLover = buildTasteProfile(
      buildEntries(
        [dramaTitle, dramaTitle, dramaTitle, dramaTitle, dramaTitle, dramaTitle].map(
          (entry, index) => ({
            ...entry,
            key: `movie:drama${index}`,
            name: `Drama ${index}`,
          }),
        ),
        Array.from({ length: 6 }, (_, index) =>
          watch({ id: `dw${index}`, titleKey: `movie:drama${index}`, watchedOn: "2024-04-01" }),
        ),
        Array.from({ length: 6 }, (_, index) => rating(`dw${index}`, "b", 8)),
      ),
      "b",
    );

    const ranked = rankPicks([sciFiTitles[0], dramaTitle], [sciFiLover, dramaLover]);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].predictions).toHaveLength(2);
    expect(ranked[0].safeScore).toBeGreaterThanOrEqual(ranked[1].safeScore);
  });

  it("measures leave-one-out accuracy once there is enough history", () => {
    const accuracy = predictionAccuracy(sciFiEntries, "a");
    expect(accuracy.count).toBe(6);
    expect(accuracy.meanAbsoluteError).not.toBeNull();
    expect(accuracy.meanAbsoluteError as number).toBeLessThan(2);

    expect(predictionAccuracy(sciFiEntries.slice(0, 3), "a").meanAbsoluteError).toBeNull();
  });
});
