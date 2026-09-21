import type { ListItem, Rating, Title, WeSawData } from "@/lib/types";

export function emptyData(): WeSawData {
  return { people: [], titles: {}, watches: [], ratings: [], listItems: [] };
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
