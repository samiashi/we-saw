import type { Dispatch, SetStateAction } from "react";
import { withRating, type ChangePayload } from "@/lib/store/helpers";
import type { ListItem, ListStatus, Rating, Watch, WeSawData } from "@/lib/types";

export function createRealtimeHandlers({
  userId,
  setData,
  schedule,
}: {
  userId: string;
  setData: Dispatch<SetStateAction<WeSawData>>;
  schedule: () => void;
}) {
  const handleRating = (payload: ChangePayload) => {
    if (payload.eventType === "DELETE") {
      const watchId = String(payload.old?.watch_id ?? "");
      const targetUser = String(payload.old?.user_id ?? "");
      if (!watchId) {
        schedule();
        return;
      }
      setData((current) => ({
        ...current,
        ratings: current.ratings.filter(
          (rating) => !(rating.watchId === watchId && rating.userId === targetUser),
        ),
      }));
      return;
    }

    const row = payload.new ?? {};
    if (row.user_id === userId) return;
    const rating: Rating = {
      watchId: String(row.watch_id),
      userId: String(row.user_id),
      score: Number(row.score),
      updatedAt: String(row.updated_at),
    };
    setData((current) => withRating(current, rating));
  };

  const handleWatch = (payload: ChangePayload) => {
    if (payload.eventType === "DELETE") {
      const id = String(payload.old?.id ?? "");
      if (!id) {
        schedule();
        return;
      }
      setData((current) => ({
        ...current,
        watches: current.watches.filter((watch) => watch.id !== id),
        ratings: current.ratings.filter((rating) => rating.watchId !== id),
      }));
      return;
    }

    const row = payload.new ?? {};
    if (row.created_by === userId) return;
    const watch: Watch = {
      id: String(row.id),
      titleKey: String(row.title_id),
      seasonNumber: row.season == null ? null : Number(row.season),
      watchedOn: row.watched_on == null ? null : String(row.watched_on),
      note: String(row.note ?? ""),
      watchers: (row.watchers as string[] | null) ?? [],
      pickedBy: (row.picked_by as string | null) ?? null,
      createdBy: (row.created_by as string | null) ?? null,
      createdAt: String(row.created_at),
    };
    setData((current) => ({
      ...current,
      watches: [watch, ...current.watches.filter((existing) => existing.id !== watch.id)],
    }));
  };

  const handleListItem = (payload: ChangePayload) => {
    if (payload.eventType === "DELETE") {
      const id = String(payload.old?.id ?? "");
      if (!id) {
        schedule();
        return;
      }
      setData((current) => ({
        ...current,
        listItems: current.listItems.filter((item) => item.id !== id),
      }));
      return;
    }

    const row = payload.new ?? {};
    if (row.added_by === userId && payload.eventType === "INSERT") return;
    const item: ListItem = {
      id: String(row.id),
      titleKey: String(row.title_id),
      status: row.status as ListStatus,
      addedBy: (row.added_by as string | null) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    setData((current) => ({
      ...current,
      listItems: [item, ...current.listItems.filter((existing) => existing.id !== item.id)],
    }));
  };

  return { handleRating, handleWatch, handleListItem };
}
