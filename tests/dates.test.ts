import { describe, expect, it } from "vitest";
import { formatWatchDate, localDateString } from "@/lib/dates";

describe("localDateString", () => {
  it("keeps the local calendar day around midnight", () => {
    const justAfterMidnight = new Date(2026, 0, 15, 0, 30);
    expect(localDateString(justAfterMidnight)).toBe("2026-01-15");

    const lateEvening = new Date(2026, 0, 15, 23, 45);
    expect(localDateString(lateEvening)).toBe("2026-01-15");
  });

  it("pads months and days", () => {
    expect(localDateString(new Date(2026, 8, 3, 12, 0))).toBe("2026-09-03");
  });
});

describe("formatWatchDate", () => {
  it("labels an unknown date instead of guessing", () => {
    expect(formatWatchDate(null)).toBe("Date unknown");
  });
});
