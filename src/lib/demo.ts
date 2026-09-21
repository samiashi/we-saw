import { localDateString } from "@/lib/dates";
import { seedTitles } from "@/lib/seed";
import type { Person, Rating, Title, Watch, WeSawData } from "@/lib/types";

export const DEMO_PEOPLE: Person[] = [
  { id: "demo-a", name: "Sam" },
  { id: "demo-b", name: "Noor" },
];

interface DemoPlan {
  index: number;
  daysAgo: number;
  season?: number;
  watchers: "both" | "a" | "b";
  a: number;
  b: number;
}

const PLAN: DemoPlan[] = [
  { index: 15, daysAgo: 74, season: 1, watchers: "both", a: 9, b: 8 },
  { index: 0, daysAgo: 69, watchers: "both", a: 8, b: 7 },
  { index: 4, daysAgo: 61, watchers: "both", a: 9, b: 9 },
  { index: 7, daysAgo: 56, watchers: "both", a: 9, b: 5 },
  { index: 17, daysAgo: 48, season: 1, watchers: "both", a: 10, b: 9 },
  { index: 5, daysAgo: 41, watchers: "both", a: 8, b: 9 },
  { index: 12, daysAgo: 34, watchers: "a", a: 8, b: 0 },
  { index: 24, daysAgo: 28, season: 1, watchers: "both", a: 7, b: 9 },
  { index: 3, daysAgo: 21, watchers: "both", a: 10, b: 8 },
  { index: 9, daysAgo: 16, watchers: "b", a: 0, b: 8 },
  { index: 20, daysAgo: 9, season: 1, watchers: "both", a: 9, b: 7 },
  { index: 22, daysAgo: 3, season: 1, watchers: "both", a: 8, b: 8 },
];

export function buildDemoData(now = new Date()): WeSawData {
  const titles: Record<string, Title> = {};
  const watches: Watch[] = [];
  const ratings: Rating[] = [];

  PLAN.forEach((plan, order) => {
    const title = seedTitles[plan.index];
    if (!title) return;

    titles[title.key] = title;
    const watchedOn = localDateString(new Date(now.getTime() - plan.daysAgo * 86400000));
    const watchers =
      plan.watchers === "both"
        ? ["demo-a", "demo-b"]
        : [plan.watchers === "a" ? "demo-a" : "demo-b"];
    const watchId = `demo-w${order}`;

    watches.push({
      id: watchId,
      titleKey: title.key,
      seasonNumber: plan.season ?? null,
      watchedOn,
      note: "",
      watchers,
      createdBy: "demo-a",
      createdAt: `${watchedOn}T20:00:00.000Z`,
    });

    if (watchers.includes("demo-a")) {
      ratings.push({
        watchId,
        userId: "demo-a",
        score: plan.a,
        updatedAt: `${watchedOn}T21:00:00.000Z`,
      });
    }
    if (watchers.includes("demo-b")) {
      ratings.push({
        watchId,
        userId: "demo-b",
        score: plan.b,
        updatedAt: `${watchedOn}T21:05:00.000Z`,
      });
    }
  });

  return { people: DEMO_PEOPLE, titles, watches, ratings, listItems: [] };
}
