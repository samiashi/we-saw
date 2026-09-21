import type { CriticScores, MediaType, NextEpisode, Title, TitleSummary } from "@/lib/types";

export interface CatalogHealth {
  tmdb: boolean;
  omdb: boolean;
}

export interface WatchProvider {
  name: string;
  logoPath: string | null;
}

export interface RegionProviders {
  link: string | null;
  flatrate: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

export type ProvidersByRegion = Record<string, RegionProviders>;

const AIR_TTL_MS = 30 * 60 * 1000;
const RECO_TTL_MS = 30 * 60 * 1000;
const TRENDING_TTL_MS = 10 * 60 * 1000;
const DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const CRITIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROVIDERS_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;

const detailsCache = new Map<string, { at: number; data: Title }>();
const criticCache = new Map<string, { at: number; data: CriticScores }>();
const providersCache = new Map<string, { at: number; data: ProvidersByRegion }>();
const airCache = new Map<string, { at: number; data: Record<string, NextEpisode | null> }>();
const similarCache = new Map<string, { at: number; data: TitleSummary[] }>();
let trendingCache: { at: number; data: TitleSummary[] } | null = null;

function cacheGet<T>(cache: Map<string, { at: number; data: T }>, key: string, ttl: number) {
  const cached = cache.get(key);
  if (!cached || Date.now() - cached.at >= ttl) return null;
  return cached.data;
}

function cacheSet<T>(cache: Map<string, { at: number; data: T }>, key: string, data: T) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

interface CatalogResponse {
  error?: string;
  missing?: string;
  message?: string;
  ok?: boolean;
  tmdb?: boolean;
  omdb?: boolean;
  results?: TitleSummary[];
  title?: Title;
  imdb?: number | null;
  rt?: number | null;
  metacritic?: number | null;
  fetchedAt?: string;
  regions?: ProvidersByRegion;
  air?: Record<string, NextEpisode | null>;
  failed?: string[];
}

async function callCatalog(
  params: Record<string, string>,
): Promise<{ status: number; body: CatalogResponse }> {
  const url = new URL("/api/catalog", window.location.origin);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as CatalogResponse;
  return { status: response.status, body };
}

export async function catalogHealth(): Promise<CatalogHealth | null> {
  try {
    const { status, body } = await callCatalog({ action: "health" });
    if (status !== 200) return null;
    return { tmdb: Boolean(body.tmdb), omdb: Boolean(body.omdb) };
  } catch {
    return null;
  }
}

export async function searchCatalog(query: string): Promise<TitleSummary[] | null> {
  try {
    const { status, body } = await callCatalog({ action: "search", q: query });
    if (status === 200 && body.results) return body.results;
  } catch {
    // treat as unavailable below
  }
  return null;
}

function criticFor(imdbId: string | null): CriticScores | null {
  if (!imdbId) return null;
  return cacheGet(criticCache, imdbId, CRITIC_TTL_MS);
}

export async function fetchTitleDetails(summary: TitleSummary): Promise<Title | null> {
  const cached = cacheGet(detailsCache, summary.key, DETAILS_TTL_MS);
  if (cached) return cached;
  if (!summary.tmdbId) return null;

  try {
    const { status, body } = await callCatalog({
      action: "title",
      type: summary.type,
      id: String(summary.tmdbId),
    });
    if (status === 200 && body.title) {
      const title = {
        ...body.title,
        critic: criticFor(body.title.imdbId),
        addedAt: new Date().toISOString(),
      };
      cacheSet(detailsCache, summary.key, title);
      return title;
    }
  } catch {
    // fall through to null
  }
  return null;
}

export async function fetchCriticScores(imdbId: string): Promise<CriticScores | null> {
  const cached = cacheGet(criticCache, imdbId, CRITIC_TTL_MS);
  if (cached) return cached;

  try {
    const { status, body } = await callCatalog({ action: "ratings", imdb: imdbId });
    if (status !== 200) return null;
    const scores: CriticScores = {
      imdb: body.imdb ?? null,
      rt: body.rt ?? null,
      metacritic: body.metacritic ?? null,
      fetchedAt: body.fetchedAt ?? new Date().toISOString(),
    };
    cacheSet(criticCache, imdbId, scores);
    return scores;
  } catch {
    return null;
  }
}

const IMAGE_BASE = "/img";

export function posterUrl(
  title: Pick<Title, "posterPath">,
  size: "w92" | "w200" | "w342" | "w500" = "w200",
): string | null {
  return title.posterPath ? `${IMAGE_BASE}/${size}${title.posterPath}` : null;
}

export function backdropUrl(
  title: Pick<Title, "backdropPath">,
  size: "w780" | "w1280" = "w780",
): string | null {
  return title.backdropPath ? `${IMAGE_BASE}/${size}${title.backdropPath}` : null;
}

export function providerLogoUrl(logoPath: string | null): string | null {
  return logoPath ? `${IMAGE_BASE}/w92${logoPath}` : null;
}

export async function fetchProviders(
  type: MediaType,
  tmdbId: number,
): Promise<ProvidersByRegion | null> {
  const key = `${type}:${tmdbId}`;
  const cached = cacheGet(providersCache, key, PROVIDERS_TTL_MS);
  if (cached) return cached;

  try {
    const { status, body } = await callCatalog({ action: "providers", type, id: String(tmdbId) });
    if (status !== 200 || !body.regions) return null;
    cacheSet(providersCache, key, body.regions);
    return body.regions;
  } catch {
    return null;
  }
}

export async function fetchAirdates(keys: string[]): Promise<Record<string, NextEpisode | null>> {
  if (!keys.length) return {};
  const cacheKey = [...keys].sort().join(",");
  const cached = cacheGet(airCache, cacheKey, AIR_TTL_MS);
  if (cached) return cached;

  try {
    const { status, body } = await callCatalog({ action: "air", keys: cacheKey });
    if (status !== 200 || !body.air) return {};
    const failed = new Set(body.failed ?? []);
    const data = Object.fromEntries(Object.entries(body.air).filter(([key]) => !failed.has(key)));
    if (!failed.size && Object.keys(data).length === keys.length) {
      cacheSet(airCache, cacheKey, data);
    }
    return data;
  } catch {
    return {};
  }
}

export async function fetchTrending(): Promise<TitleSummary[]> {
  if (trendingCache && Date.now() - trendingCache.at < TRENDING_TTL_MS) return trendingCache.data;

  try {
    const { status, body } = await callCatalog({ action: "trending" });
    if (status !== 200 || !body.results) return [];
    trendingCache = { at: Date.now(), data: body.results };
    return body.results;
  } catch {
    return [];
  }
}

export async function fetchSimilar(type: MediaType, tmdbId: number): Promise<TitleSummary[]> {
  const key = `${type}:${tmdbId}`;
  const cached = cacheGet(similarCache, key, RECO_TTL_MS);
  if (cached) return cached;

  try {
    const { status, body } = await callCatalog({ action: "similar", type, id: String(tmdbId) });
    if (status !== 200 || !body.results) return [];
    cacheSet(similarCache, key, body.results);
    return body.results;
  } catch {
    return [];
  }
}

export function fallbackTitle(summary: TitleSummary): Title {
  return {
    key: summary.key,
    tmdbId: summary.tmdbId,
    imdbId: null,
    type: summary.type,
    name: summary.name,
    year: summary.year,
    posterPath: summary.posterPath,
    backdropPath: null,
    overview: summary.overview ?? "",
    genres: [],
    directors: [],
    cast: [],
    runtimeMinutes: null,
    seasons: [],
    originalLanguage: null,
    countries: [],
    critic: null,
    addedAt: new Date().toISOString(),
  };
}

export function titleToSummary(title: Title): TitleSummary {
  const { key, tmdbId, type, name, year, posterPath, overview } = title;
  return { key, tmdbId, type, name, year, posterPath, overview };
}
