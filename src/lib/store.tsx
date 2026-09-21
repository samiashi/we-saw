import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildEntries } from "@/lib/analytics";
import { retryWrite } from "@/lib/retry";
import {
  emptyData,
  errorText,
  generateInviteCode,
  reconcileAfterLog,
  withRating,
} from "@/lib/store/helpers";
import {
  mapAppInvite,
  mapHousehold,
  mapInvite,
  mapListItem,
  mapPerson,
  mapRating,
  mapWatch,
} from "@/lib/store/mappers";
import { createRealtimeHandlers } from "@/lib/store/realtime";
import { supabase } from "@/lib/supabase";
import type {
  AppInvite,
  Entry,
  Household,
  InviteCode,
  ListItem,
  ListStatus,
  LogInput,
  Person,
  Rating,
  Title,
  Watch,
  WeSawData,
} from "@/lib/types";

export type AddToListResult = "added" | "exists" | "failed";

export interface WeSawStore {
  ready: boolean;
  people: Person[];
  userId: string | null;
  household: Household | null;
  needsOnboarding: boolean;
  partnerJoined: boolean;
  clearPartnerJoined: () => void;
  signedOut: boolean;
  syncError: string;
  clearSyncError: () => void;
  titles: Record<string, Title>;
  entries: Entry[];
  listItems: ListItem[];
  addToList: (title: Title) => Promise<AddToListResult>;
  setListStatus: (itemId: string, status: ListStatus) => Promise<boolean>;
  removeFromList: (itemId: string) => Promise<boolean>;
  nameFor: (userId: string) => string;
  canEditScore: (userId: string, watchers: string[]) => boolean;
  logWatch: (input: LogInput) => Promise<boolean>;
  setRating: (watchId: string, userId: string, score: number) => Promise<boolean>;
  removeWatch: (watchId: string) => Promise<boolean>;
  patchTitle: (key: string, patch: Partial<Title>) => Promise<void>;
  renamePerson: (personId: string, name: string) => Promise<void>;
  renameHousehold: (name: string) => Promise<void>;
  invites: InviteCode[];
  createInvite: () => Promise<string | null>;
  revokeInvite: (code: string) => Promise<boolean>;
  redeemInvite: (code: string, displayName: string) => Promise<string | null>;
  appInvites: AppInvite[];
  createAppInvite: () => Promise<string | null>;
  revokeAppInvite: (code: string) => Promise<boolean>;
  createHousehold: (
    householdName: string,
    displayName: string,
    inviteCode: string,
  ) => Promise<string | null>;
  refresh: () => Promise<void>;
  auth: ReturnType<typeof useAuth>;
}

const StoreContext = createContext<WeSawStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.session?.user.id ?? null;

  const [data, setData] = useState<WeSawData>(emptyData);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [appInvites, setAppInvites] = useState<AppInvite[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const householdId = household?.id ?? null;
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [partnerJoinedFor, setPartnerJoinedFor] = useState<string | null>(null);
  const memberCount = useRef(0);
  const [syncError, setSyncError] = useState("");
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadAt = useRef(0);
  const loadId = useRef(0);
  const channelSeq = useRef(0);
  const dataRef = useRef(data);
  const userIdRef = useRef(userId);
  const ratingWrites = useRef(new Map<string, Promise<unknown>>());
  const persistedRatings = useRef(new Map<string, Rating | null>());
  const listWrites = useRef(new Set<string>());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadCloud = useCallback(async () => {
    if (!supabase || !userId) return;
    const id = ++loadId.current;
    const [
      membersResult,
      titlesResult,
      watchesResult,
      ratingsResult,
      invitesResult,
      listResult,
      householdResult,
      appInvitesResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select("user_id, display_name, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("titles").select("id, payload"),
      supabase
        .from("watches")
        .select(
          "id, title_id, seasons, watched_on, note, watchers, picked_by, created_by, created_at",
        ),
      supabase.from("ratings").select("watch_id, user_id, score, updated_at"),
      supabase
        .from("invite_codes")
        .select("code, created_by, created_at, consumed_by, consumed_at"),
      supabase.from("list_items").select("id, title_id, status, added_by, created_at, updated_at"),
      supabase.from("households").select("id, name"),
      supabase.from("app_invites").select("code, invited_by, created_at, consumed_by, consumed_at"),
    ]);

    if (id !== loadId.current || userIdRef.current !== userId) return;

    for (const result of [
      membersResult,
      titlesResult,
      watchesResult,
      ratingsResult,
      listResult,
      householdResult,
    ]) {
      if (result.error) {
        setSyncError(errorText(result.error));
        return;
      }
    }

    const members = membersResult.data ?? [];
    const memberIds = members.map((member) => member.user_id);
    const previousCount = memberCount.current;
    memberCount.current = members.length;
    if (previousCount > 0 && members.length > previousCount) setPartnerJoinedFor(userId);
    const householdRow = householdResult.data?.[0] ?? null;
    const ratings = (ratingsResult.data ?? []).map(mapRating);
    persistedRatings.current = new Map(
      ratings
        .filter((rating) => rating.userId === userId)
        .map((rating) => [`${rating.watchId}:${rating.userId}`, rating]),
    );
    setHousehold(householdRow ? mapHousehold(householdRow) : null);
    setNeedsOnboarding(!members.some((member) => member.user_id === userId));
    if (!appInvitesResult.error) setAppInvites((appInvitesResult.data ?? []).map(mapAppInvite));
    if (!invitesResult.error) setInvites((invitesResult.data ?? []).map(mapInvite));
    setData({
      people: members.map(mapPerson),
      titles: Object.fromEntries(
        (titlesResult.data ?? []).map((row) => [row.id, row.payload as Title]),
      ),
      watches: (watchesResult.data ?? []).map((row) => mapWatch(row, memberIds)),
      ratings,
      listItems: (listResult.data ?? []).map(mapListItem),
    });
    lastLoadAt.current = Date.now();
    setSyncError("");
    setLoadedUserId(userId);
  }, [userId]);

  useEffect(() => {
    userIdRef.current = userId;
    loadId.current += 1;
    memberCount.current = 0;
    persistedRatings.current = new Map();
    ratingWrites.current = new Map();
    listWrites.current = new Set();

    if (!userId) return;
    const timer = setTimeout(() => void loadCloud(), 0);
    return () => clearTimeout(timer);
  }, [userId, loadCloud]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;

    const schedule = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void loadCloud(), 600);
    };

    const { handleRating, handleWatch, handleListItem } = createRealtimeHandlers({
      setData,
      schedule,
    });

    channelSeq.current += 1;
    const channel = client
      .channel(`wesaw-changes-${channelSeq.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "titles" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, handleRating);

    if (householdId) {
      const filter = `household_id=eq.${householdId}`;
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "watches", filter },
          handleWatch,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "invite_codes", filter },
          schedule,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "list_items", filter },
          handleListItem,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "households" }, schedule);
    }

    channel.subscribe();

    const onFocus = () => {
      if (Date.now() - lastLoadAt.current > 30_000) void loadCloud();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      window.removeEventListener("focus", onFocus);
      void client.removeChannel(channel).catch(() => undefined);
    };
  }, [userId, householdId, loadCloud]);

  const people = useMemo(
    () =>
      [...data.people].sort(
        (a, b) =>
          (a.id === userId ? -1 : 0) - (b.id === userId ? -1 : 0) || a.name.localeCompare(b.name),
      ),
    [data.people, userId],
  );

  const entries = useMemo(
    () => buildEntries(Object.values(data.titles), data.watches, data.ratings),
    [data.titles, data.watches, data.ratings],
  );

  async function patchTitle(key: string, patch: Partial<Title>) {
    const existing = dataRef.current.titles[key];
    if (!existing || !supabase) return;
    const client = supabase;
    const next = { ...existing, ...patch };

    try {
      const { error } = await retryWrite(() =>
        client
          .from("titles")
          .upsert({ id: key, payload: next, updated_at: new Date().toISOString() }),
      );
      if (error) {
        setSyncError(errorText(error));
        return;
      }
      setData((current) => ({
        ...current,
        titles: { ...current.titles, [key]: { ...(current.titles[key] ?? existing), ...patch } },
      }));
    } catch (error) {
      setSyncError(errorText(error));
    }
  }

  async function logWatch(input: LogInput) {
    if (!supabase || !userId) return false;
    const client = supabase;
    const now = new Date().toISOString();
    const watch: Watch = {
      id: crypto.randomUUID(),
      titleKey: input.title.key,
      seasonNumbers: input.seasonNumbers,
      watchedOn: input.watchedOn,
      note: input.note.trim(),
      watchers: input.watchers,
      pickedBy: input.pickedBy,
      createdBy: userId,
      createdAt: now,
    };
    const ownRatings: Rating[] = input.scores
      .filter((score) => score.userId === userId)
      .map((score) => ({
        watchId: watch.id,
        userId: score.userId,
        score: score.score,
        updatedAt: now,
      }));

    try {
      const titleWrite = await retryWrite(() =>
        client
          .from("titles")
          .upsert({ id: input.title.key, payload: input.title, updated_at: now }),
      );
      if (titleWrite.error) {
        setSyncError(errorText(titleWrite.error));
        return false;
      }

      const watchWrite = await retryWrite(() =>
        client.from("watches").insert({
          id: watch.id,
          title_id: watch.titleKey,
          seasons: watch.seasonNumbers,
          watched_on: watch.watchedOn,
          note: watch.note,
          watchers: watch.watchers,
          picked_by: watch.pickedBy ?? null,
          created_by: userId,
          household_id: householdId,
        }),
      );
      if (watchWrite.error) {
        setSyncError(errorText(watchWrite.error));
        return false;
      }

      if (ownRatings.length) {
        const ratingWrite = await retryWrite(() =>
          client.from("ratings").upsert(
            ownRatings.map((rating) => ({
              watch_id: rating.watchId,
              user_id: rating.userId,
              score: rating.score,
              updated_at: rating.updatedAt,
            })),
          ),
        );
        if (ratingWrite.error) setSyncError(errorText(ratingWrite.error));
      }

      const currentItems = dataRef.current.listItems;
      const nextItems = reconcileAfterLog(currentItems, input.title, now);
      if (nextItems !== currentItems) {
        const removedIds = currentItems
          .filter((item) => !nextItems.some((next) => next.id === item.id))
          .map((item) => item.id);
        const changed = nextItems.filter((next) =>
          currentItems.some((item) => item.id === next.id && item.status !== next.status),
        );

        for (const id of removedIds) {
          const { error } = await retryWrite(() => client.from("list_items").delete().eq("id", id));
          if (error) setSyncError(errorText(error));
        }
        for (const item of changed) {
          const { error } = await retryWrite(() =>
            client
              .from("list_items")
              .update({ status: item.status, updated_at: item.updatedAt })
              .eq("id", item.id),
          );
          if (error) setSyncError(errorText(error));
        }
      }

      setData((current) => ({
        ...current,
        titles: { ...current.titles, [input.title.key]: input.title },
        watches: [watch, ...current.watches.filter((existing) => existing.id !== watch.id)],
        ratings: [
          ...current.ratings.filter(
            (rating) => !ownRatings.some((own) => own.watchId === rating.watchId),
          ),
          ...ownRatings,
        ],
        listItems: reconcileAfterLog(current.listItems, input.title, now),
      }));

      for (const rating of ownRatings) {
        persistedRatings.current.set(`${rating.watchId}:${rating.userId}`, rating);
      }
      void loadCloud();
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  async function setRating(watchId: string, targetUserId: string, score: number): Promise<boolean> {
    if (!supabase || !userId || targetUserId !== userId) return false;
    const client = supabase;
    const next: Rating = {
      watchId,
      userId: targetUserId,
      score,
      updatedAt: new Date().toISOString(),
    };
    const key = `${watchId}:${targetUserId}`;

    if (!persistedRatings.current.has(key)) {
      persistedRatings.current.set(
        key,
        dataRef.current.ratings.find(
          (rating) => rating.watchId === watchId && rating.userId === targetUserId,
        ) ?? null,
      );
    }
    const previous = persistedRatings.current.get(key) ?? null;
    setData((current) => withRating(current, next));

    const queued = (ratingWrites.current.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() =>
        retryWrite(() =>
          client.from("ratings").upsert({
            watch_id: watchId,
            user_id: targetUserId,
            score,
            updated_at: next.updatedAt,
          }),
        ),
      );
    ratingWrites.current.set(key, queued);

    const restore = () =>
      setData((current) =>
        previous
          ? withRating(current, previous)
          : {
              ...current,
              ratings: current.ratings.filter(
                (rating) => !(rating.watchId === watchId && rating.userId === targetUserId),
              ),
            },
      );

    try {
      const { error } = await queued;
      const isLatest = ratingWrites.current.get(key) === queued;
      if (isLatest) ratingWrites.current.delete(key);
      if (error) {
        setSyncError(errorText(error));
        if (isLatest) restore();
        return false;
      }
      persistedRatings.current.set(key, next);
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      if (ratingWrites.current.get(key) === queued) {
        ratingWrites.current.delete(key);
        restore();
      }
      return false;
    }
  }

  async function removeWatch(watchId: string) {
    if (!supabase) return false;
    const client = supabase;
    try {
      const { error } = await retryWrite(() => client.from("watches").delete().eq("id", watchId));
      if (error) {
        setSyncError(errorText(error));
        return false;
      }
      setData((current) => ({
        ...current,
        watches: current.watches.filter((watch) => watch.id !== watchId),
        ratings: current.ratings.filter((rating) => rating.watchId !== watchId),
      }));
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  async function renamePerson(personId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || !supabase || personId !== userId) return;
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.from("members").update({ display_name: trimmed }).eq("user_id", personId),
      );
      if (error) {
        setSyncError(errorText(error));
        return;
      }
      setData((current) => ({
        ...current,
        people: current.people.map((person) =>
          person.id === personId ? { ...person, name: trimmed } : person,
        ),
      }));
    } catch (error) {
      setSyncError(errorText(error));
    }
  }

  async function addToList(title: Title): Promise<AddToListResult> {
    if (!supabase || !userId) return "failed";
    const client = supabase;
    const existing = dataRef.current.listItems.find((item) => item.titleKey === title.key);
    if (existing) {
      if (existing.status !== "done" && existing.status !== "dropped") return "exists";
      const revived = await setListStatus(existing.id, "queued");
      return revived ? "added" : "failed";
    }
    if (listWrites.current.has(title.key)) return "exists";

    listWrites.current.add(title.key);
    try {
      const now = new Date().toISOString();
      const item: ListItem = {
        id: crypto.randomUUID(),
        titleKey: title.key,
        status: "queued",
        addedBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      const titleWrite = await retryWrite(() =>
        client.from("titles").upsert({ id: title.key, payload: title, updated_at: now }),
      );
      if (titleWrite.error) {
        setSyncError(errorText(titleWrite.error));
        return "failed";
      }

      const listWrite = await retryWrite(() =>
        client.from("list_items").insert({
          id: item.id,
          title_id: item.titleKey,
          status: item.status,
          added_by: userId,
          household_id: householdId,
        }),
      );
      if (listWrite.error) {
        setSyncError(errorText(listWrite.error));
        return "failed";
      }

      setData((current) => ({
        ...current,
        titles: { ...current.titles, [title.key]: title },
        listItems: current.listItems.some((entry) => entry.titleKey === title.key)
          ? current.listItems
          : [item, ...current.listItems],
      }));
      return "added";
    } catch (error) {
      setSyncError(errorText(error));
      return "failed";
    } finally {
      listWrites.current.delete(title.key);
    }
  }

  async function setListStatus(itemId: string, status: ListStatus): Promise<boolean> {
    if (!supabase) return false;
    const client = supabase;
    const now = new Date().toISOString();
    try {
      const { error } = await retryWrite(() =>
        client.from("list_items").update({ status, updated_at: now }).eq("id", itemId),
      );
      if (error) {
        setSyncError(errorText(error));
        return false;
      }
      setData((current) => ({
        ...current,
        listItems: current.listItems.map((item) =>
          item.id === itemId ? { ...item, status, updatedAt: now } : item,
        ),
      }));
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  async function removeFromList(itemId: string) {
    if (!supabase) return false;
    const client = supabase;
    try {
      const { error } = await retryWrite(() => client.from("list_items").delete().eq("id", itemId));
      if (error) {
        setSyncError(errorText(error));
        return false;
      }
      setData((current) => ({
        ...current,
        listItems: current.listItems.filter((item) => item.id !== itemId),
      }));
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  async function refresh() {
    await loadCloud();
  }

  async function createInvite(): Promise<string | null> {
    if (!supabase || !userId || !household) return null;
    const client = supabase;
    const code = generateInviteCode();
    try {
      const { error } = await retryWrite(() =>
        client
          .from("invite_codes")
          .insert({ code, created_by: userId, household_id: household.id }),
      );
      if (error) {
        setSyncError(errorText(error));
        return null;
      }
      await loadCloud();
      return code;
    } catch (error) {
      setSyncError(errorText(error));
      return null;
    }
  }

  async function revokeInvite(code: string) {
    if (!supabase) return false;
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.from("invite_codes").delete().eq("code", code),
      );
      if (error) {
        setSyncError(errorText(error));
        return false;
      }
      setInvites((current) => current.filter((invite) => invite.code !== code));
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  async function redeemInvite(code: string, displayName: string): Promise<string | null> {
    if (!supabase) return "Cloud sync is not configured.";
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.rpc("redeem_invite", {
          invite_code: code,
          display_name: displayName,
        }),
      );
      if (error) return errorText(error);
      await loadCloud();
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async function createHousehold(
    householdName: string,
    displayName: string,
    inviteCode: string,
  ): Promise<string | null> {
    if (!supabase) return "Cloud sync is not configured.";
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.rpc("create_household", {
          household_name: householdName,
          display_name: displayName,
          invite_code: inviteCode.trim() || null,
        }),
      );
      if (error) return errorText(error);
      await loadCloud();
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async function renameHousehold(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !supabase || !household) return;
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.from("households").update({ name: trimmed }).eq("id", household.id),
      );
      if (error) {
        setSyncError(errorText(error));
        return;
      }
      setHousehold({ ...household, name: trimmed });
    } catch (error) {
      setSyncError(errorText(error));
    }
  }

  async function createAppInvite(): Promise<string | null> {
    if (!supabase || !userId) return null;
    const client = supabase;
    try {
      const { data, error } = await retryWrite(() => client.rpc("create_app_invite"));
      if (error) {
        setSyncError(errorText(error));
        return null;
      }
      await loadCloud();
      return typeof data === "string" ? data : null;
    } catch (error) {
      setSyncError(errorText(error));
      return null;
    }
  }

  async function revokeAppInvite(code: string) {
    if (!supabase) return false;
    const client = supabase;
    try {
      const { error } = await retryWrite(() =>
        client.from("app_invites").delete().eq("code", code),
      );
      if (error) {
        setSyncError(errorText(error));
        return false;
      }
      setAppInvites((current) => current.filter((invite) => invite.code !== code));
      return true;
    } catch (error) {
      setSyncError(errorText(error));
      return false;
    }
  }

  const value: WeSawStore = {
    ready: userId != null && loadedUserId === userId,
    people,
    userId,
    household,
    needsOnboarding,
    partnerJoined: partnerJoinedFor === userId,
    clearPartnerJoined: () => setPartnerJoinedFor(null),
    signedOut: !auth.isAuthLoading && !userId,
    syncError,
    clearSyncError: () => setSyncError(""),
    titles: data.titles,
    entries,
    listItems: data.listItems,
    addToList,
    setListStatus,
    removeFromList,
    nameFor: (id) => people.find((person) => person.id === id)?.name ?? "Member",
    canEditScore: (id, watchers) => watchers.includes(id) && id === userId,
    logWatch,
    setRating,
    removeWatch,
    patchTitle,
    renamePerson,
    renameHousehold,
    invites,
    createInvite,
    revokeInvite,
    redeemInvite,
    appInvites,
    createAppInvite,
    revokeAppInvite,
    createHousehold,
    refresh,
    auth,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): WeSawStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
