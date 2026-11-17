import { describe, expect, it } from "vitest";
import { buildTonightContext, compactTitle } from "../server/tonightContext.js";

const payload = {
  key: "tv:1",
  type: "tv",
  name: "A series",
  year: "1999",
  genres: ["Drama"],
  cast: Array.from({ length: 10 }, (_, i) => `Actor ${i}`),
  directors: ["A creator"],
  originalLanguage: "fr",
  countries: ["FR"],
  runtimeMinutes: 50,
};

describe("Full-history model context", () => {
  it("keeps all stored credits, season-run ratings, dislikes and viewer attribution", () => {
    const context = buildTonightContext(
      [
        {
          title_id: "tv:1",
          title: { payload },
          watchers: ["a", "b"],
          seasons: [1, 2],
          ratings: [
            { user_id: "a", score: 9 },
            { user_id: "b", score: 2 },
          ],
        },
        {
          title_id: "tv:1",
          title: { payload },
          watchers: ["a"],
          seasons: [3],
          ratings: [{ user_id: "a", score: 3 }],
        },
        { title_id: "movie:2", title: { payload: null }, watchers: ["a"], ratings: [] },
      ],
      ["a", "b"],
    );
    expect(context.historyCount).toBe(3);
    expect(context.ratedCount).toBe(2);
    expect(context.seen.has("movie:2")).toBe(true);
    expect(context.taste[0]).toMatchObject({
      ratedWatches: 2,
      meanRating: 6,
      facets: {
        cast: expect.arrayContaining([
          { name: "Actor 9", count: 2, meanRating: 6, relativePreference: 0 },
        ]),
        directors: [{ name: "A creator", count: 2, meanRating: 6, relativePreference: 0 }],
        languages: [{ name: "fr", count: 2, meanRating: 6, relativePreference: 0 }],
        decades: [{ name: "1990s", count: 2, meanRating: 6, relativePreference: 0 }],
      },
    });
    expect(context.taste[1]).toMatchObject({ ratedWatches: 1, meanRating: 2 });
    expect(context.evidence([compactTitle(payload)])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "together",
          seasons: [1, 2],
          ratings: { "Viewer 1": 9, "Viewer 2": 2 },
        }),
        expect.objectContaining({ scope: "solo", seasons: [3], ratings: { "Viewer 1": 3 } }),
      ]),
    );
  });
  it("retains candidate-specific evidence even when a facet is outside the bounded summary", () => {
    const watches = Array.from({ length: 60 }, (_, i) => ({
      title_id: `movie:${i + 1}`,
      title: {
        payload: { ...payload, type: "movie", cast: [`Actor ${String(i).padStart(2, "0")}`] },
      },
      watchers: ["a"],
      ratings: [{ user_id: "a", score: 8 }],
    }));
    const context = buildTonightContext(watches, ["a"]);
    expect(context.taste[0].facets.cast.some((c: { name: string }) => c.name === "Actor 30")).toBe(
      false,
    );
    const candidate = compactTitle({ ...payload, cast: ["Actor 30"] });
    expect(context.candidateTaste(candidate)[0].facets.cast).toMatchObject([
      { name: "Actor 30", count: 1, meanRating: 8 },
    ]);
  });
});
