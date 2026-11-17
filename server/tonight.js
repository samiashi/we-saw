import { generateTonightPicks } from "./tonightModel.js";
import { buildTonightContext, compactTitle, validKey } from "./tonightContext.js";
import { discoverTonight } from "./tonightDiscovery.js";

const result = (status, body) => ({ status, body, cacheControl: "private, no-store" });
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

export async function handleTonight({ env, method, authorization, body, catalog }) {
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
  if (!env.OPENAI_API_KEY || !env.TMDB_API_KEY || !base || !key)
    return result(503, { error: "not_configured" });

  const deadline = AbortSignal.timeout(48000);
  async function cloud(path, params = {}, post = false) {
    const url = new URL(path, base);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    return fetch(url, {
      method: post ? "POST" : "GET",
      headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
      ...(post ? { body: "{}" } : {}),
      signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
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
    // Keyset pagination reads the entire household history, including unrated
    // watches for exclusion. Never silently substitute a recent-history slice.
    const watches = [];
    let after;
    while (true) {
      const page = await read("watches", {
        select: "id,title_id,watchers,seasons,title:titles(payload),ratings(user_id,score)",
        household_id: `eq.${household}`,
        order: "id.asc",
        limit: "200",
        ...(after ? { id: `gt.${after}` } : {}),
      });
      if (!Array.isArray(page)) throw new Error("Invalid history");
      watches.push(...page);
      if (!page.length) break;
      const next = page.at(-1)?.id;
      if (typeof next !== "string" || (after && next <= after))
        throw new Error("Invalid history cursor");
      after = next;
      // Continue even on a short page: a project can enforce a smaller row cap.
    }
    const context = buildTonightContext(watches, viewers);
    const counts = { historyCount: context.historyCount, ratedCount: context.ratedCount };
    if (!watches.length)
      return result(200, { picks: [], titles: [], candidateCount: 0, ...counts });
    const quota = await cloud("/rest/v1/rpc/consume_tonight_request", {}, true);
    if (!quota.ok) return result(503, { error: "usage_unavailable" });
    if ((await quota.json()) !== true) return result(429, { error: "rate_limited" });
    const titles = await discoverTonight(
      context,
      prefs,
      catalog,
      AbortSignal.any([deadline, AbortSignal.timeout(22000)]),
    );
    const candidates = titles.flatMap((title) => {
      const compact = compactTitle(title);
      return compact ? [{ ...compact, tasteEvidence: context.candidateTaste(compact) }] : [];
    });
    if (!candidates.length)
      return result(200, { picks: [], titles: [], candidateCount: 0, ...counts });
    const picks = await generateTonightPicks(
      {
        preferences: { mood: prefs.mood, type: prefs.type, maxMinutes: prefs.maxMinutes },
        viewerCount: viewers.length,
        ...counts,
        taste: context.taste,
        candidates,
        history: context.evidence(candidates),
      },
      env.OPENAI_API_KEY,
      deadline,
    );
    return result(200, {
      picks,
      candidateCount: candidates.length,
      ...counts,
      titles: titles.filter((title) => picks.some((pick) => pick.key === title.key)),
    });
  } catch {
    return result(502, { error: "recommendations_unavailable" });
  }
}
