import type {
  AppInvite,
  InviteCode,
  ListItem,
  ListStatus,
  Person,
  Rating,
  Watch,
} from "@/lib/types";

type Row = Record<string, unknown>;

export function mapPerson(row: Row): Person {
  return { id: String(row.user_id), name: String(row.display_name || "Member") };
}

export function mapHousehold(row: Row): { id: string; name: string } {
  return { id: String(row.id), name: String(row.name) };
}

export function mapWatch(row: Row, memberIds: string[]): Watch {
  return {
    id: String(row.id),
    titleKey: String(row.title_id),
    seasonNumber: row.season == null ? null : Number(row.season),
    watchedOn: String(row.watched_on),
    note: String(row.note ?? ""),
    watchers:
      Array.isArray(row.watchers) && row.watchers.length ? (row.watchers as string[]) : memberIds,
    pickedBy: (row.picked_by as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function mapRating(row: Row): Rating {
  return {
    watchId: String(row.watch_id),
    userId: String(row.user_id),
    score: Number(row.score),
    updatedAt: String(row.updated_at),
  };
}

export function mapListItem(row: Row): ListItem {
  return {
    id: String(row.id),
    titleKey: String(row.title_id),
    status: row.status as ListStatus,
    addedBy: (row.added_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapInvite(row: Row): InviteCode {
  return {
    code: String(row.code),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    consumedBy: (row.consumed_by as string | null) ?? null,
    consumedAt: (row.consumed_at as string | null) ?? null,
  };
}

export function mapAppInvite(row: Row): AppInvite {
  return {
    code: String(row.code),
    invitedBy: (row.invited_by as string | null) ?? null,
    createdAt: String(row.created_at),
    consumedBy: (row.consumed_by as string | null) ?? null,
    consumedAt: (row.consumed_at as string | null) ?? null,
  };
}
