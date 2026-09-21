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
import {
  defaultPeople,
  emptyData,
  errorText,
  generateInviteCode,
  loadLocal,
  reconcileAfterLog,
  STORAGE_KEY,
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
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
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

export interface WeSawStore {
  ready: boolean;
  mode: "local" | "cloud";
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
  addToList: (title: Title) => Promise<boolean>;
  setListStatus: (itemId: string, status: ListStatus) => Promise<void>;
  removeFromList: (itemId: string) => Promise<void>;
  nameFor: (userId: string) => string;
  canEditScore: (userId: string, watchers: string[]) => boolean;
  logWatch: (input: LogInput) => Promise<void>;
  setRating: (watchId: string, userId: string, score: number) => Promise<void>;
  removeWatch: (watchId: string) => Promise<void>;
  patchTitle: (key: string, patch: Partial<Title>) => Promise<void>;
  renamePerson: (personId: string, name: string) => Promise<void>;
  renameHousehold: (name: string) => Promise<void>;
  invites: InviteCode[];
  createInvite: () => Promise<string | null>;
  revokeInvite: (code: string) => Promise<void>;
  redeemInvite: (code: string, displayName: string) => Promise<string | null>;
  appInvites: AppInvite[];
  createAppInvite: () => Promise<string | null>;
  revokeAppInvite: (code: string) => Promise<void>;
  createHousehold: (
    householdName: string,
    displayName: string,
    inviteCode: string,
  ) => Promise<string | null>;
  refresh: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => boolean;
  clearAll: () => void;
  auth: ReturnType<typeof useAuth>;
}

const StoreContext = createContext<WeSawStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const mode: "local" | "cloud" = isSupabaseConfigured ? "cloud" : "local";
  const userId = auth.session?.user.id ?? null;

  const [data, setData] = useState<WeSawData>(() => (mode === "local" ? loadLocal() : emptyData()));
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [appInvites, setAppInvites] = useState<AppInvite[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const householdId = household?.id ?? null;
  const [ready, setReady] = useState(mode === "local");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const memberCount = useRef(0);
  const [syncError, setSyncError] = useState("");
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadAt = useRef(0);

  const loadCloud = useCallback(async () => {
    if (!supabase || !userId) return;
    lastLoadAt.current = Date.now();
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
          "id, title_id, season, watched_on, note, watchers, picked_by, created_by, created_at",
        ),
      supabase.from("ratings").select("watch_id, user_id, score, updated_at"),
      supabase
        .from("invite_codes")
        .select("code, created_by, created_at, consumed_by, consumed_at"),
      supabase.from("list_items").select("id, title_id, status, added_by, created_at, updated_at"),
      supabase.from("households").select("id, name"),
      supabase.from("app_invites").select("code, invited_by, created_at, consumed_by, consumed_at"),
    ]);

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
        setReady(true);
        return;
      }
    }

    const members = membersResult.data ?? [];
    const memberIds = members.map((member) => member.user_id);
    const previousCount = memberCount.current;
    memberCount.current = members.length;
    if (previousCount > 0 && members.length > previousCount) setPartnerJoined(true);
    const householdRow = householdResult.data?.[0] ?? null;
    setHousehold(householdRow ? mapHousehold(householdRow) : null);
    setNeedsOnboarding(!members.some((member) => member.user_id === userId));
    setAppInvites(appInvitesResult.error ? [] : (appInvitesResult.data ?? []).map(mapAppInvite));
    setInvites(invitesResult.error ? [] : (invitesResult.data ?? []).map(mapInvite));
    setData({
      people: members.map(mapPerson),
      titles: Object.fromEntries(
        (titlesResult.data ?? []).map((row) => [row.id, row.payload as Title]),
      ),
      watches: (watchesResult.data ?? []).map((row) => mapWatch(row, memberIds)),
      ratings: (ratingsResult.data ?? []).map(mapRating),
      listItems: (listResult.data ?? []).map(mapListItem),
    });
    setSyncError("");
    setReady(true);
  }, [userId]);

  useEffect(() => {
    if (mode !== "cloud" || !userId) return;
    const timer = setTimeout(() => void loadCloud(), 0);
    return () => clearTimeout(timer);
  }, [mode, userId, loadCloud]);

  useEffect(() => {
    if (mode !== "cloud" || !supabase || !userId) return;
    const client = supabase;

    const schedule = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void loadCloud(), 600);
    };

    const { handleRating, handleWatch, handleListItem } = createRealtimeHandlers({
      userId,
      setData,
      schedule,
    });

    const channel = client
      .channel("wesaw-changes")
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
      void client.removeChannel(channel);
    };
  }, [mode, userId, householdId, loadCloud]);

  useEffect(() => {
    if (mode !== "local") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.warn("Could not save to this device's storage.");
    }
  }, [mode, data]);

  const people = useMemo(() => {
    if (mode === "local") return data.people;
    return [...data.people].sort(
      (a, b) =>
        (a.id === userId ? -1 : 0) - (b.id === userId ? -1 : 0) || a.name.localeCompare(b.name),
    );
  }, [mode, data.people, userId]);

  const entries = useMemo(
    () => buildEntries(Object.values(data.titles), data.watches, data.ratings),
    [data.titles, data.watches, data.ratings],
  );

  async function patchTitle(key: string, patch: Partial<Title>) {
    const existing = data.titles[key];
    if (!existing) return;
    const next = { ...existing, ...patch };

    if (mode === "local" || !supabase) {
      setData((current) => ({ ...current, titles: { ...current.titles, [key]: next } }));
      return;
    }

    const { error } = await supabase
      .from("titles")
      .upsert({ id: key, payload: next, updated_at: new Date().toISOString() });
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setData((current) => ({ ...current, titles: { ...current.titles, [key]: next } }));
  }

  async function logWatch(input: LogInput) {
    const now = new Date().toISOString();
    const watch: Watch = {
      id: crypto.randomUUID(),
      titleKey: input.title.key,
      seasonNumber: input.seasonNumber,
      watchedOn: input.watchedOn,
      note: input.note.trim(),
      watchers: input.watchers,
      pickedBy: input.pickedBy,
      createdBy: userId,
      createdAt: now,
    };
    const nextRatings: Rating[] = input.scores.map((score) => ({
      watchId: watch.id,
      userId: score.userId,
      score: score.score,
      updatedAt: now,
    }));

    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        titles: { ...current.titles, [input.title.key]: input.title },
        watches: [watch, ...current.watches],
        ratings: [...current.ratings, ...nextRatings],
        listItems: reconcileAfterLog(current.listItems, input.title, now),
      }));
      return;
    }

    const titleWrite = await supabase
      .from("titles")
      .upsert({ id: input.title.key, payload: input.title, updated_at: now });
    if (titleWrite.error) {
      setSyncError(errorText(titleWrite.error));
      return;
    }

    const watchWrite = await supabase.from("watches").insert({
      id: watch.id,
      title_id: watch.titleKey,
      season: watch.seasonNumber,
      watched_on: watch.watchedOn,
      note: watch.note,
      watchers: watch.watchers,
      picked_by: watch.pickedBy ?? null,
      created_by: userId,
      household_id: household?.id ?? null,
    });
    if (watchWrite.error) {
      setSyncError(errorText(watchWrite.error));
      return;
    }

    const ownRatings = nextRatings
      .filter((rating) => rating.userId === userId)
      .map((rating) => ({
        watch_id: rating.watchId,
        user_id: rating.userId,
        score: rating.score,
        updated_at: now,
      }));

    if (ownRatings.length) {
      const ratingWrite = await supabase.from("ratings").upsert(ownRatings);
      if (ratingWrite.error) {
        setSyncError(errorText(ratingWrite.error));
        return;
      }
    }

    const currentItems = data.listItems;
    const nextItems = reconcileAfterLog(currentItems, input.title, now);
    if (nextItems !== currentItems) {
      const removedIds = currentItems
        .filter((item) => !nextItems.some((next) => next.id === item.id))
        .map((item) => item.id);
      const changed = nextItems.filter((next) =>
        currentItems.some((item) => item.id === next.id && item.status !== next.status),
      );

      for (const id of removedIds) {
        const { error } = await supabase.from("list_items").delete().eq("id", id);
        if (error) setSyncError(errorText(error));
      }
      for (const item of changed) {
        const { error } = await supabase
          .from("list_items")
          .update({ status: item.status, updated_at: item.updatedAt })
          .eq("id", item.id);
        if (error) setSyncError(errorText(error));
      }
      setData((current) => ({ ...current, listItems: nextItems }));
    }

    await loadCloud();
  }

  async function setRating(watchId: string, targetUserId: string, score: number) {
    const next: Rating = {
      watchId,
      userId: targetUserId,
      score,
      updatedAt: new Date().toISOString(),
    };

    if (mode === "local" || !supabase) {
      setData((current) => withRating(current, next));
      return;
    }

    if (targetUserId !== userId) return;
    const { error } = await supabase
      .from("ratings")
      .upsert({ watch_id: watchId, user_id: targetUserId, score, updated_at: next.updatedAt });
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setData((current) => withRating(current, next));
  }

  async function removeWatch(watchId: string) {
    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        watches: current.watches.filter((watch) => watch.id !== watchId),
        ratings: current.ratings.filter((rating) => rating.watchId !== watchId),
      }));
      return;
    }

    const { error } = await supabase.from("watches").delete().eq("id", watchId);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setData((current) => ({
      ...current,
      watches: current.watches.filter((watch) => watch.id !== watchId),
      ratings: current.ratings.filter((rating) => rating.watchId !== watchId),
    }));
  }

  async function renamePerson(personId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        people: current.people.map((person) =>
          person.id === personId ? { ...person, name: trimmed } : person,
        ),
      }));
      return;
    }

    if (personId !== userId) return;
    const { error } = await supabase
      .from("members")
      .update({ display_name: trimmed })
      .eq("user_id", personId);
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
  }

  async function addToList(title: Title): Promise<boolean> {
    const existing = data.listItems.find((item) => item.titleKey === title.key);
    if (existing) {
      if (existing.status !== "done" && existing.status !== "dropped") return false;
      await setListStatus(existing.id, "queued");
      return true;
    }

    const now = new Date().toISOString();
    const item: ListItem = {
      id: crypto.randomUUID(),
      titleKey: title.key,
      status: "queued",
      addedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        titles: { ...current.titles, [title.key]: title },
        listItems: [item, ...current.listItems],
      }));
      return true;
    }

    const titleWrite = await supabase
      .from("titles")
      .upsert({ id: title.key, payload: title, updated_at: now });
    if (titleWrite.error) {
      setSyncError(errorText(titleWrite.error));
      return false;
    }

    const listWrite = await supabase.from("list_items").insert({
      id: item.id,
      title_id: item.titleKey,
      status: item.status,
      added_by: userId,
      household_id: household?.id ?? null,
    });
    if (listWrite.error) {
      setSyncError(errorText(listWrite.error));
      return false;
    }

    setData((current) => ({
      ...current,
      titles: { ...current.titles, [title.key]: title },
      listItems: [item, ...current.listItems],
    }));
    return true;
  }

  async function setListStatus(itemId: string, status: ListStatus) {
    const now = new Date().toISOString();

    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        listItems: current.listItems.map((item) =>
          item.id === itemId ? { ...item, status, updatedAt: now } : item,
        ),
      }));
      return;
    }

    const { error } = await supabase
      .from("list_items")
      .update({ status, updated_at: now })
      .eq("id", itemId);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setData((current) => ({
      ...current,
      listItems: current.listItems.map((item) =>
        item.id === itemId ? { ...item, status, updatedAt: now } : item,
      ),
    }));
  }

  async function removeFromList(itemId: string) {
    if (mode === "local" || !supabase) {
      setData((current) => ({
        ...current,
        listItems: current.listItems.filter((item) => item.id !== itemId),
      }));
      return;
    }

    const { error } = await supabase.from("list_items").delete().eq("id", itemId);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setData((current) => ({
      ...current,
      listItems: current.listItems.filter((item) => item.id !== itemId),
    }));
  }

  async function refresh() {
    if (mode === "cloud") await loadCloud();
  }

  async function createInvite(): Promise<string | null> {
    if (mode !== "cloud" || !supabase || !userId) return null;
    const code = generateInviteCode();
    const { error } = await supabase
      .from("invite_codes")
      .insert({ code, created_by: userId, household_id: household?.id ?? null });
    if (error) {
      setSyncError(errorText(error));
      return null;
    }
    await loadCloud();
    return code;
  }

  async function revokeInvite(code: string) {
    if (mode !== "cloud" || !supabase) return;
    const { error } = await supabase.from("invite_codes").delete().eq("code", code);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setInvites((current) => current.filter((invite) => invite.code !== code));
  }

  async function redeemInvite(code: string, displayName: string): Promise<string | null> {
    if (mode !== "cloud" || !supabase) return "Cloud sync is not configured.";
    const { error } = await supabase.rpc("redeem_invite", {
      invite_code: code,
      display_name: displayName,
    });
    if (error) return errorText(error);
    await loadCloud();
    return null;
  }

  async function createHousehold(
    householdName: string,
    displayName: string,
    inviteCode: string,
  ): Promise<string | null> {
    if (mode !== "cloud" || !supabase) return "Cloud sync is not configured.";
    const { error } = await supabase.rpc("create_household", {
      household_name: householdName,
      display_name: displayName,
      invite_code: inviteCode.trim() || null,
    });
    if (error) return errorText(error);
    await loadCloud();
    return null;
  }

  async function renameHousehold(name: string) {
    const trimmed = name.trim();
    if (!trimmed || mode !== "cloud" || !supabase || !household) return;
    const { error } = await supabase
      .from("households")
      .update({ name: trimmed })
      .eq("id", household.id);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setHousehold({ ...household, name: trimmed });
  }

  async function createAppInvite(): Promise<string | null> {
    if (mode !== "cloud" || !supabase) return null;
    const { data, error } = await supabase.rpc("create_app_invite");
    if (error) {
      setSyncError(errorText(error));
      return null;
    }
    await loadCloud();
    return typeof data === "string" ? data : null;
  }

  async function revokeAppInvite(code: string) {
    if (mode !== "cloud" || !supabase) return;
    const { error } = await supabase.from("app_invites").delete().eq("code", code);
    if (error) {
      setSyncError(errorText(error));
      return;
    }
    setAppInvites((current) => current.filter((invite) => invite.code !== code));
  }

  function exportData() {
    return JSON.stringify(data, null, 2);
  }

  function importData(json: string) {
    if (mode === "cloud") return false;
    try {
      const parsed = JSON.parse(json) as Partial<WeSawData>;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.watches)) return false;
      setData({
        people:
          Array.isArray(parsed.people) && parsed.people.length >= 2
            ? (parsed.people as Person[])
            : defaultPeople,
        titles:
          parsed.titles && typeof parsed.titles === "object"
            ? (parsed.titles as Record<string, Title>)
            : {},
        watches: parsed.watches as Watch[],
        ratings: Array.isArray(parsed.ratings) ? (parsed.ratings as Rating[]) : [],
        listItems: Array.isArray(parsed.listItems) ? (parsed.listItems as ListItem[]) : [],
      });
      return true;
    } catch {
      return false;
    }
  }

  function clearAll() {
    setData((current) => ({ ...emptyData(), people: current.people }));
  }

  const value: WeSawStore = {
    ready,
    mode,
    people,
    userId,
    household,
    needsOnboarding,
    partnerJoined,
    clearPartnerJoined: () => setPartnerJoined(false),
    signedOut: mode === "cloud" && !auth.isAuthLoading && !userId,
    syncError,
    clearSyncError: () => setSyncError(""),
    titles: data.titles,
    entries,
    listItems: data.listItems,
    addToList,
    setListStatus,
    removeFromList,
    nameFor: (id) => people.find((person) => person.id === id)?.name ?? "Member",
    canEditScore: (id, watchers) => watchers.includes(id) && (mode === "local" || id === userId),
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
    exportData,
    importData,
    clearAll,
    auth,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): WeSawStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
