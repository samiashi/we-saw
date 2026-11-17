import { generateTonightPicks } from "./tonightModel.js";

const result = (status, body) => ({ status, body, cacheControl: "private, no-store" });
const validKey = (key) => typeof key === "string" && /^(movie|tv):[1-9]\d*$/.test(key);
const text = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");
const names = (values, limit) =>
  Array.isArray(values) ? values.slice(0, limit).map((value) => text(value, 80)) : [];

function preferences(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { mood = "", type = "all", maxMinutes = null, excluded = [] } = body;
  if (
    typeof mood !== "string" ||
    mood.length > 500 ||
    !["all", "movie", "tv"].includes(type) ||
    (maxMinutes !== null &&
      (!Number.isInteger(maxMinutes) || maxMinutes < 15 || maxMinutes > 300)) ||
    !Array.isArray(excluded) ||
    excluded.length > 100 ||
    excluded.some((key) => !validKey(key))
  )
    return null;
  return { mood: mood.trim(), type, maxMinutes, excluded };
}

function compactTitle(payload, key) {
  if (
    !payload ||
    !validKey(key) ||
    !["movie", "tv"].includes(payload.type) ||
    !key.startsWith(`${payload.type}:`) ||
    !payload.name
  )
    return null;
  return {
    key,
    name: text(payload.name, 160),
    type: payload.type,
    year: text(payload.year, 4),
    overview: text(payload.overview, 600),
    genres: names(payload.genres, 8),
    cast: names(payload.cast, 3),
    directors: names(payload.directors, 3),
    runtimeMinutes:
      Number.isFinite(payload.runtimeMinutes) && payload.runtimeMinutes > 0
        ? payload.runtimeMinutes
        : null,
  };
}

export async function handleTonight({ env, method, authorization, body }) {
  if (method !== "POST") return result(405, { error: "method_not_allowed" });
  if (
    typeof authorization !== "string" ||
    !/^Bearer \S+$/.test(authorization) ||
    authorization.length > 8192
  )
    return result(401, { error: "unauthorized" });
  const prefs = preferences(body);
  if (!prefs) return result(400, { error: "invalid_preferences" });
  const base = env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!env.OPENAI_API_KEY || !base || !key) return result(503, { error: "not_configured" });

  async function cloud(path, params = {}, post = false) {
    const url = new URL(path, base);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    return fetch(url, {
      method: post ? "POST" : "GET",
      headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
      ...(post ? { body: "{}" } : {}),
      signal: AbortSignal.timeout(8000),
    });
  }
  async function read(path, params) {
    const response = await cloud(`/rest/v1/${path}`, params);
    if (!response.ok) throw new Error("History unavailable");
    return response.json();
  }

  try {
    const authResponse = await cloud("/auth/v1/user");
    if (!authResponse.ok)
      return result(authResponse.status === 401 || authResponse.status === 403 ? 401 : 503, {
        error: "session_unavailable",
      });
    const user = await authResponse.json();
    if (!user.id) return result(401, { error: "unauthorized" });
    const members = await read("members", {
      select: "user_id,household_id",
      order: "created_at.asc",
      limit: "20",
    });
    const household = members.find((member) => member.user_id === user.id)?.household_id;
    if (!household) return result(403, { error: "membership_required" });
    const viewers = members
      .filter((member) => member.household_id === household)
      .map((member) => member.user_id);
    const [items, watches] = await Promise.all([
      read("list_items", {
        select: "title_id,status,title:titles(payload)",
        household_id: `eq.${household}`,
        status: "in.(queued,watching)",
        order: "created_at.desc,id.asc",
        limit: "1000",
      }),
      read("watches", {
        select: "title_id,watchers,title:titles(payload),ratings(user_id,score)",
        household_id: `eq.${household}`,
        order: "created_at.desc,id.asc",
        limit: "100",
      }),
    ]);
    const eligible = items
      .filter((item) => ["queued", "watching"].includes(item.status))
      .map((item) => compactTitle(item.title?.payload, item.title_id))
      .filter(
        (title) =>
          title &&
          !prefs.excluded.includes(title.key) &&
          (prefs.type === "all" || prefs.type === title.type) &&
          (prefs.maxMinutes === null ||
            (title.runtimeMinutes !== null && title.runtimeMinutes <= prefs.maxMinutes)),
      );
    const candidates = [...new Map(eligible.map((title) => [title.key, title])).values()].slice(
      0,
      40,
    );
    if (!candidates.length) return result(200, { picks: [], candidateCount: 0 });
    const history = watches
      .map((watch) => {
        const title = compactTitle(
          watch.title?.payload,
          watch.title_id ?? watch.title?.payload?.key,
        );
        if (!title) return null;
        const ratings = Object.fromEntries(
          viewers.flatMap((id, index) => {
            const rating = (watch.ratings ?? []).find(
              (rating) =>
                rating.user_id === id &&
                watch.watchers?.includes(id) &&
                Number.isInteger(rating.score) &&
                rating.score >= 1 &&
                rating.score <= 10,
            );
            return rating ? [[`Viewer ${index + 1}`, rating.score]] : [];
          }),
        );
        if (!Object.keys(ratings).length) return null;
        return {
          ...title,
          overview: undefined,
          scope: watch.watchers?.length > 1 ? "together" : "solo",
          ratings,
        };
      })
      .filter(Boolean)
      .slice(0, 60);
    const quota = await cloud("/rest/v1/rpc/consume_tonight_request", {}, true);
    if (!quota.ok) return result(503, { error: "usage_unavailable" });
    if ((await quota.json()) !== true) return result(429, { error: "rate_limited" });
    const picks = await generateTonightPicks(
      {
        preferences: { mood: prefs.mood, type: prefs.type, maxMinutes: prefs.maxMinutes },
        viewerCount: viewers.length,
        candidates,
        history,
      },
      env.OPENAI_API_KEY,
    );
    return result(200, { picks, candidateCount: candidates.length });
  } catch {
    return result(502, { error: "recommendations_unavailable" });
  }
}
