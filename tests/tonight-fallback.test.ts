import { describe, expect, it } from "vitest";
import { filterTonightTitles } from "@/lib/analytics";
import type { Title } from "@/lib/types";

const title = (key: string, runtimeMinutes: number | null, type: "movie" | "tv" = "movie") =>
  ({ key, runtimeMinutes, type, genres: ["Comedy"], cast: [], directors: [] }) as unknown as Title;
describe("Tonight fallback candidates", () => {
  it("keeps explicit type, runtime and exclusions when AI is unavailable", () => {
    expect(
      filterTonightTitles(
        [
          title("movie:1", 90),
          title("movie:2", null),
          title("movie:3", 150),
          title("tv:4", 30, "tv"),
          title("movie:5", 80),
        ],
        { type: "movie", maxMinutes: 100, excluded: ["movie:5"] },
      ).map((t) => t.key),
    ).toEqual(["movie:1"]);
  });
});
