import { seedTitleByKey } from "@/lib/seed";
import type { ListItem, Person, Rating, Title, WeSawData } from "@/lib/types";

export const STORAGE_KEY = "wesaw.data.v1";
export const LOCAL_A = "p1";
export const LOCAL_B = "p2";

export const defaultPeople: Person[] = [
  { id: LOCAL_A, name: "You" },
  { id: LOCAL_B, name: "Partner" },
];

export function emptyData(): WeSawData {
  return { people: defaultPeople, titles: {}, watches: [], ratings: [], listItems: [] };
}

export function reconcileAfterLog(items: ListItem[], title: Title, now: string): ListItem[] {
  const item = items.find((entry) => entry.titleKey === title.key);
  if (!item) return items;

  if (title.type === "movie") {
    if (item.status === "done") return items;
    return items.map((entry): ListItem =>
      entry.id === item.id ? { ...entry, status: "done", updatedAt: now } : entry,
    );
  }

  if (item.status === "watching") return items;
  return items.map((entry): ListItem =>
    entry.id === item.id ? { ...entry, status: "watching", updatedAt: now } : entry,
  );
}

function withSeedPosters(titles: Record<string, Title>): Record<string, Title> {
  return Object.fromEntries(
    Object.entries(titles).map(([key, title]) => {
      if (title?.posterPath) return [key, title];
      const posterPath = seedTitleByKey(key)?.posterPath;
      return [key, posterPath ? { ...title, posterPath } : title];
    }),
  );
}

export function loadLocal(): WeSawData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<WeSawData>;
    const people =
      Array.isArray(parsed.people) && parsed.people.length >= 2
        ? (parsed.people as Person[])
        : defaultPeople;
    const fallbackWatchers = people.map((person) => person.id);
    const watches = (Array.isArray(parsed.watches) ? parsed.watches : []).map((watch) => ({
      ...watch,
      watchers:
        Array.isArray(watch.watchers) && watch.watchers.length ? watch.watchers : fallbackWatchers,
    }));

    return {
      people,
      titles:
        parsed.titles && typeof parsed.titles === "object"
          ? withSeedPosters(parsed.titles as Record<string, Title>)
          : {},
      watches,
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings : [],
      listItems: Array.isArray(parsed.listItems) ? (parsed.listItems as ListItem[]) : [],
    };
  } catch {
    return emptyData();
  }
}

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(8));
  return [...values].map((value) => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join("");
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: unknown }).message);
  return String(error);
}

export interface ChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export function withRating(data: WeSawData, rating: Rating): WeSawData {
  return {
    ...data,
    ratings: [
      ...data.ratings.filter(
        (item) => !(item.watchId === rating.watchId && item.userId === rating.userId),
      ),
      rating,
    ],
  };
}
