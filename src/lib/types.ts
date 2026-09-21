export type MediaType = "movie" | "tv";

export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  year: string | null;
}

export interface CriticScores {
  imdb: number | null;
  rt: number | null;
  metacritic: number | null;
  fetchedAt: string;
}

export interface NextEpisode {
  airDate: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  name: string;
}

export interface Title {
  key: string;
  tmdbId: number | null;
  imdbId: string | null;
  type: MediaType;
  name: string;
  year: string | null;
  posterPath: string | null;
  backdropPath?: string | null;
  overview: string;
  genres: string[];
  directors: string[];
  cast: string[];
  runtimeMinutes: number | null;
  seasons: SeasonInfo[];
  nextEpisode?: NextEpisode | null;
  tvStatus?: string | null;
  originalLanguage?: string | null;
  countries?: string[];
  critic: CriticScores | null;
  addedAt: string;
}

export type TitleSummary = Pick<
  Title,
  "key" | "tmdbId" | "type" | "name" | "year" | "posterPath"
> & {
  overview?: string;
  genreNames?: string[];
  voteAverage?: number | null;
  voteCount?: number | null;
};

export interface Watch {
  id: string;
  titleKey: string;
  /** TV seasons covered by this watch, sorted; null means the whole show. */
  seasonNumbers: number[] | null;
  watchedOn: string | null;
  note: string;
  watchers: string[];
  pickedBy?: string | null;
  /** True when the pair picked it together; pickedBy stays null then. */
  pickedTogether?: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface Rating {
  watchId: string;
  userId: string;
  score: number;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
}

export interface LogInput {
  title: Title;
  /** TV seasons covered by this watch, sorted; null means the whole show. */
  seasonNumbers: number[] | null;
  watchedOn: string | null;
  note: string;
  watchers: string[];
  pickedBy: string | null;
  pickedTogether: boolean;
  scores: { userId: string; score: number }[];
}

export interface InviteCode {
  code: string;
  createdBy: string | null;
  createdAt: string;
  consumedBy: string | null;
  consumedAt: string | null;
}

export type ListStatus = "queued" | "watching" | "dropped" | "done";

export interface Household {
  id: string;
  name: string;
}

export interface AppInvite {
  code: string;
  invitedBy: string | null;
  createdAt: string;
  consumedBy: string | null;
  consumedAt: string | null;
}

export interface ListItem {
  id: string;
  titleKey: string;
  status: ListStatus;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  watch: Watch;
  title: Title;
  scores: Record<string, number>;
  combined: number | null;
  gap: number | null;
}

export interface WeSawData {
  people: Person[];
  titles: Record<string, Title>;
  watches: Watch[];
  ratings: Rating[];
  listItems: ListItem[];
}
