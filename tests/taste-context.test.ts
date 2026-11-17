import { describe, expect, it } from "vitest";
import { buildTasteContext, filterTasteHistory } from "../server/tasteContext.js";

const watch = (id: string, score = 8) => ({
  id,
  title_id: `movie:${Number(id.slice(1)) + 1}`,
  watchers: ["a", "b"],
  watched_on: "2026-02-01",
  title: {
    payload: {
      key: "movie:1",
      type: "movie",
      name: "Mystery",
      year: "1999",
      genres: ["Mystery"],
      cast: ["Actor"],
      directors: ["Director"],
      originalLanguage: "en",
      countries: ["GB"],
      runtimeMinutes: 90,
    },
  },
  ratings: [
    { user_id: "a", score },
    { user_id: "b", score: 4 },
  ],
});

describe("Taste analysis context", () => {
  it("aggregates every watch including old low ratings and keeps viewers separate", () => {
    const watches = Array.from({ length: 405 }, (_, i) => watch(`w${i}`, i < 200 ? 2 : 10));
    const context = buildTasteContext(watches, ["a", "b"]);
    expect(context.historyCount).toBe(405);
    expect(context.ratedCount).toBe(405);
    const a = context.metrics.find((m) => m.viewerId === "a" && m.facet === "genres");
    const b = context.metrics.find((m) => m.viewerId === "b" && m.facet === "genres");
    expect(a).toMatchObject({ count: 405, meanRating: 6.05 });
    expect(b).toMatchObject({ count: 405, meanRating: 4 });
    expect(a?.evidence.length).toBeLessThanOrEqual(4);
  });
  it("matches Stats scope, watch-date year and type filters, including unknown dates", () => {
    const joint = watch("w1");
    const solo = { ...watch("w2"), watchers: ["a"] };
    const unknown = { ...watch("w3"), watched_on: null };
    const old = { ...watch("w4"), watched_on: "2025-12-31" };
    const tv = { ...watch("w5"), title: { payload: { ...joint.title.payload, type: "tv" } } };
    const rows = [joint, solo, unknown, old, tv];
    expect(filterTasteHistory(rows, { scopeId: "together", year: "2026", type: "movie" })).toEqual([
      joint,
    ]);
    expect(filterTasteHistory(rows, { scopeId: "a", year: "all", type: "all" })).toEqual([solo]);
    expect(filterTasteHistory(rows, { scopeId: "together", year: "all", type: "movie" })).toEqual([
      joint,
      unknown,
      old,
    ]);
    expect(filterTasteHistory(rows, { scopeId: "together", year: "2026", type: "tv" })).toEqual([
      tv,
    ]);
  });
  it("does not count missing ratings as dislikes and reports missing metadata", () => {
    const context = buildTasteContext(
      [watch("w1"), { ...watch("w2"), ratings: [] }, { ...watch("w3"), title: null }],
      ["a", "b"],
    );
    expect(context).toMatchObject({ historyCount: 3, ratedCount: 1, missingMetadataCount: 1 });
    expect(context.metrics).toEqual([]);
    expect(context.profiles[0]).toMatchObject({ ratedWatches: 1, meanRating: 8 });
  });
  it("ignores ratings from non-watchers and deduplicates facet names", () => {
    const row = watch("w1");
    row.watchers = ["a"];
    row.title.payload.genres = ["Mystery", "Mystery"];
    const context = buildTasteContext([row, { ...row, id: "w2" }], ["a", "b"]);
    expect(context.metrics.find((m) => m.facet === "genres")).toMatchObject({ count: 2 });
    expect(context.metrics.some((m) => m.viewerId === "b")).toBe(false);
  });
});
