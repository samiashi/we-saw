const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";
const REQUEST_TIMEOUT_MS = 8000;
const PUBLIC_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const MAX_AIR_KEYS = 40;

const GENRE_NAMES = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Science Fiction",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  10770: "TV Movie",
};

function json(status, body, cacheControl = "no-store") {
  return { status, body, cacheControl };
}

function isSameOriginRequest({ origin, referer, host, secFetchSite }) {
  if (!host) return false;
  if (secFetchSite === "cross-site") return false;

  const sameHost = (value) => {
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };

  if (origin) return sameHost(origin);
  if (referer) return sameHost(referer);
  return secFetchSite === "same-origin";
}

function fetchWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

async function tmdbFetch(path, key, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(name, String(value));
  }
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDB ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

function yearOf(date) {
  return typeof date === "string" && date.length >= 4 ? date.slice(0, 4) : null;
}

function mapSearchItem(item) {
  const type = item.media_type;
  if (type !== "movie" && type !== "tv") return null;
  return {
    key: `${type}:${item.id}`,
    tmdbId: item.id,
    type,
    name: type === "movie" ? item.title : item.name,
    year: yearOf(type === "movie" ? item.release_date : item.first_air_date),
    posterPath: item.poster_path ?? null,
    overview: item.overview ?? "",
    genreNames: (item.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter(Boolean),
    voteAverage:
      typeof item.vote_average === "number" && item.vote_average > 0
        ? Math.round(item.vote_average * 10) / 10
        : null,
    voteCount: item.vote_count ?? null,
  };
}

function mapNextEpisode(next) {
  if (!next) return null;
  return {
    airDate: next.air_date ?? null,
    seasonNumber: next.season_number ?? null,
    episodeNumber: next.episode_number ?? null,
    name: next.name ?? "",
  };
}

function mapProviders(list) {
  return (list ?? []).map((entry) => ({
    name: entry.provider_name,
    logoPath: entry.logo_path ?? null,
  }));
}

async function search(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const q = String(query.q ?? "").trim();
  if (!q) return json(400, { error: "missing_query" });

  const data = await tmdbFetch("/search/multi", env.TMDB_API_KEY, {
    query: q,
    include_adult: "false",
    page: 1,
  });
  const results = (data.results ?? []).map(mapSearchItem).filter(Boolean).slice(0, 20);
  return json(200, { results }, PUBLIC_CACHE);
}

async function title(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const type = query.type === "tv" ? "tv" : "movie";
  const id = Number(query.id);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: "missing_id" });

  const data = await tmdbFetch(`/${type}/${id}`, env.TMDB_API_KEY, {
    append_to_response: "credits,external_ids",
  });

  const credits = data.credits ?? {};
  const imdbId = data.external_ids?.imdb_id ?? data.imdb_id ?? null;
  const base = {
    key: `${type}:${data.id}`,
    tmdbId: data.id,
    imdbId,
    type,
    name: type === "movie" ? data.title : data.name,
    year: yearOf(type === "movie" ? data.release_date : data.first_air_date),
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview: data.overview ?? "",
    genres: (data.genres ?? []).map((genre) => genre.name),
    originalLanguage: data.original_language ?? null,
    countries:
      data.origin_country ??
      (data.production_countries ?? []).map((country) => country.iso_3166_1).slice(0, 3),
  };

  if (type === "movie") {
    const directors = (credits.crew ?? [])
      .filter((member) => member.job === "Director")
      .map((member) => member.name);
    return json(
      200,
      {
        title: {
          ...base,
          directors: [...new Set(directors)],
          cast: (credits.cast ?? []).slice(0, 10).map((member) => member.name),
          runtimeMinutes: data.runtime || null,
          seasons: [],
        },
      },
      PUBLIC_CACHE,
    );
  }

  const seasons = (data.seasons ?? [])
    .filter((season) => season.season_number >= 1)
    .map((season) => ({
      seasonNumber: season.season_number,
      name: season.name,
      episodeCount: season.episode_count ?? 0,
      year: yearOf(season.air_date),
    }));

  return json(
    200,
    {
      title: {
        ...base,
        directors: (data.created_by ?? []).map((person) => person.name),
        cast: (credits.cast ?? []).slice(0, 10).map((member) => member.name),
        runtimeMinutes: data.episode_run_time?.[0] || null,
        seasons,
        nextEpisode: mapNextEpisode(data.next_episode_to_air),
        tvStatus: data.status ?? null,
      },
    },
    PUBLIC_CACHE,
  );
}

async function trending(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const type = query.type === "movie" || query.type === "tv" ? query.type : "all";
  const window = query.window === "day" ? "day" : "week";

  const data = await tmdbFetch(`/trending/${type}/${window}`, env.TMDB_API_KEY);
  const results = (data.results ?? []).map(mapSearchItem).filter(Boolean).slice(0, 20);
  return json(200, { results }, PUBLIC_CACHE);
}

async function similar(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const type = query.type === "tv" ? "tv" : "movie";
  const id = Number(query.id);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: "missing_id" });

  const data = await tmdbFetch(`/${type}/${id}/recommendations`, env.TMDB_API_KEY);
  const results = (data.results ?? [])
    .map((item) => mapSearchItem({ ...item, media_type: type }))
    .filter(Boolean)
    .slice(0, 12);
  return json(200, { results }, PUBLIC_CACHE);
}

async function providers(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const type = query.type === "tv" ? "tv" : "movie";
  const id = Number(query.id);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: "missing_id" });

  const data = await tmdbFetch(`/${type}/${id}/watch/providers`, env.TMDB_API_KEY);
  const regions = {};

  for (const [region, entry] of Object.entries(data.results ?? {})) {
    regions[region] = {
      link: entry.link ?? null,
      flatrate: mapProviders(entry.flatrate),
      free: mapProviders(entry.free),
      ads: mapProviders(entry.ads),
      rent: mapProviders(entry.rent),
      buy: mapProviders(entry.buy),
    };
  }

  return json(200, { regions }, PUBLIC_CACHE);
}

async function air(query, env) {
  if (!env.TMDB_API_KEY) return json(503, { error: "missing_key", missing: "TMDB_API_KEY" });
  const requested = String(query.keys ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const keys = requested.slice(0, MAX_AIR_KEYS);
  const failed = [];

  const entries = await Promise.all(
    keys.map(async (key) => {
      const [type, id] = key.split(":");
      const movieId = Number(id);
      if (type !== "tv" || !Number.isInteger(movieId) || movieId <= 0) return [key, null];
      try {
        const data = await tmdbFetch(`/tv/${movieId}`, env.TMDB_API_KEY);
        return [key, mapNextEpisode(data.next_episode_to_air)];
      } catch {
        failed.push(key);
        return [key, null];
      }
    }),
  );

  const complete = !failed.length && requested.length <= MAX_AIR_KEYS;
  return json(
    200,
    { air: Object.fromEntries(entries), failed, omitted: requested.slice(MAX_AIR_KEYS) },
    complete ? PUBLIC_CACHE : "no-store",
  );
}

async function ratings(query, env) {
  if (!env.OMDB_API_KEY) return json(503, { error: "missing_key", missing: "OMDB_API_KEY" });
  const imdbId = String(query.imdb ?? "").trim();
  if (!/^tt\d{6,}$/.test(imdbId)) return json(400, { error: "missing_imdb_id" });

  const url = new URL(OMDB_BASE);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("apikey", env.OMDB_API_KEY);
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`OMDb ${response.status}`);
  const data = await response.json();
  if (data.Response === "False") return json(404, { error: "not_found" });

  const toScore = (value) => {
    if (typeof value !== "string" || value === "N/A") return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const rtEntry = (data.Ratings ?? []).find((entry) => entry.Source === "Rotten Tomatoes");
  const rt = rtEntry ? toScore(String(rtEntry.Value).replace("%", "")) : null;

  return json(
    200,
    {
      imdbId,
      imdb: toScore(data.imdbRating),
      rt,
      metacritic: toScore(data.Metascore),
      fetchedAt: new Date().toISOString(),
    },
    PUBLIC_CACHE,
  );
}

export async function handleCatalog({
  query = {},
  env = {},
  origin = null,
  referer = null,
  host = null,
  secFetchSite = null,
} = {}) {
  const action = String(query.action ?? "health");

  if (action !== "health" && !isSameOriginRequest({ origin, referer, host, secFetchSite })) {
    return json(403, { error: "forbidden" });
  }

  try {
    if (action === "health") {
      return json(200, {
        ok: true,
        tmdb: Boolean(env.TMDB_API_KEY),
        omdb: Boolean(env.OMDB_API_KEY),
      });
    }
    if (action === "search") return await search(query, env);
    if (action === "title") return await title(query, env);
    if (action === "ratings") return await ratings(query, env);
    if (action === "trending") return await trending(query, env);
    if (action === "similar") return await similar(query, env);
    if (action === "providers") return await providers(query, env);
    if (action === "air") return await air(query, env);
    return json(400, { error: "unknown_action" });
  } catch (error) {
    return json(502, { error: "upstream", message: String(error?.message ?? error).slice(0, 300) });
  }
}
