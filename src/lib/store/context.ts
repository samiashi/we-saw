import { createContext } from "react";
import type { useAuth } from "@/hooks/useAuth";
import type {
  AppInvite,
  TasteFilters,
  TasteResult,
  Entry,
  Household,
  InviteCode,
  ListItem,
  ListStatus,
  LogInput,
  Person,
  Title,
  TonightPreferences,
  TonightResult,
} from "@/lib/types";

export type AddToListResult = "added" | "exists" | "failed";

export interface WeSawStore {
  ready: boolean;
  requestTasteAnalysis: (filters: TasteFilters, signal: AbortSignal) => Promise<TasteResult>;
  requestTonightPicks: (
    preferences: TonightPreferences,
    signal: AbortSignal,
  ) => Promise<TonightResult>;
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

export const StoreContext = createContext<WeSawStore | null>(null);
