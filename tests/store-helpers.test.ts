import { describe, expect, it } from "vitest";
import { reconcileAfterLog } from "@/lib/store/helpers";
import type { ListItem, MediaType, Title } from "@/lib/types";

function listItem(overrides: Partial<ListItem> & Pick<ListItem, "id" | "titleKey">): ListItem {
  return {
    status: "queued",
    addedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function title(key: string, type: MediaType): Title {
  return {
    key,
    tmdbId: null,
    imdbId: null,
    type,
    name: "Title",
    year: "2026",
    posterPath: null,
    overview: "",
    genres: [],
    directors: [],
    cast: [],
    runtimeMinutes: null,
    seasons: [],
    critic: null,
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

const NOW = "2026-06-01T00:00:00.000Z";

describe("reconcileAfterLog", () => {
  it("marks a queued movie as done instead of deleting it", () => {
    const items = [listItem({ id: "i1", titleKey: "movie:1" })];
    const next = reconcileAfterLog(items, title("movie:1", "movie"), NOW);
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe("done");
    expect(next[0].updatedAt).toBe(NOW);
  });

  it("leaves an already-done movie untouched", () => {
    const items = [listItem({ id: "i1", titleKey: "movie:1", status: "done" })];
    expect(reconcileAfterLog(items, title("movie:1", "movie"), NOW)).toBe(items);
  });

  it("moves a queued show to watching", () => {
    const items = [listItem({ id: "i1", titleKey: "tv:1" })];
    const next = reconcileAfterLog(items, title("tv:1", "tv"), NOW);
    expect(next[0].status).toBe("watching");
  });

  it("revives a dropped show when a season is logged", () => {
    const items = [listItem({ id: "i1", titleKey: "tv:1", status: "dropped" })];
    const next = reconcileAfterLog(items, title("tv:1", "tv"), NOW);
    expect(next[0].status).toBe("watching");
  });

  it("does nothing when the title is not on the list", () => {
    const items = [listItem({ id: "i1", titleKey: "tv:9" })];
    expect(reconcileAfterLog(items, title("movie:1", "movie"), NOW)).toBe(items);
  });
});
