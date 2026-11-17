import { describe, expect, it, vi } from "vitest";
import { mapPerson, mapWatch } from "@/lib/store/mappers";
import { createRealtimeHandlers } from "@/lib/store/realtime";
import { emptyData } from "@/lib/store/helpers";
import type { WeSawData } from "@/lib/types";
import type { SetStateAction } from "react";

const row = {
  id: "watch-1",
  title_id: "movie:1",
  watchers: ["viewer"],
  watched_on: "2026-11-17",
  note: "A good watch",
  created_at: "2026-11-17T12:00:00Z",
};

describe("Cloud text fields", () => {
  it("preserves strings and does not render malformed objects as diary text", () => {
    expect(mapPerson({ user_id: "viewer", display_name: "Sam" }).name).toBe("Sam");
    expect(mapPerson({ user_id: "viewer", display_name: {} }).name).toBe("Member");
    expect(mapWatch(row, [])).toMatchObject({ watchedOn: "2026-11-17", note: "A good watch" });
    expect(mapWatch({ ...row, watched_on: {}, note: {} }, [])).toMatchObject({
      watchedOn: null,
      note: "",
    });
  });
  it("handles malformed realtime fields consistently and refreshes when a deletion lacks its key", () => {
    let state: WeSawData = emptyData();
    const schedule = vi.fn();
    const setData = (update: SetStateAction<WeSawData>) => {
      state = typeof update === "function" ? update(state) : update;
    };
    const handlers = createRealtimeHandlers({ setData, schedule });
    handlers.handleWatch({
      eventType: "INSERT",
      old: {},
      new: { ...row, watched_on: {}, note: {} },
    });
    expect(state.watches[0]).toMatchObject({ watchedOn: null, note: "" });
    handlers.handleRating({ eventType: "DELETE", new: {}, old: { watch_id: row.id, user_id: {} } });
    handlers.handleWatch({ eventType: "DELETE", new: {}, old: { id: {} } });
    handlers.handleListItem({ eventType: "DELETE", new: {}, old: { id: {} } });
    expect(schedule).toHaveBeenCalledTimes(3);
    expect(state.watches).toHaveLength(1);
    handlers.handleWatch({ eventType: "DELETE", new: {}, old: { id: row.id } });
    expect(state.watches).toHaveLength(0);
  });
});
