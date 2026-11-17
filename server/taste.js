import { createHash } from "node:crypto";
import { buildTasteContext, filterTasteHistory } from "./tasteContext.js";
import { generateTasteAnalysis } from "./tasteModel.js";

const cache = new Map();
const result = (status, body) => ({ status, body, cacheControl: "private, no-store" });

export async function handleTaste({ env, method, authorization, body }) {
  if (method !== "POST") return result(405, { error: "method_not_allowed" });
  if (
    typeof authorization !== "string" ||
    !/^Bearer \S+$/.test(authorization) ||
    authorization.length > 8192
  )
    return result(401, { error: "unauthorized" });
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.scopeId !== "string" ||
    body.scopeId.length > 64 ||
    typeof body.year !== "string" ||
    (body.year !== "all" && !/^[1-9]\d{3}$/.test(body.year)) ||
    !["all", "movie", "tv"].includes(body.type)
  )
    return result(400, { error: "invalid_filters" });
  const filters = { scopeId: body.scopeId, year: body.year, type: body.type };
  const base = env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!env.OPENAI_API_KEY || !base || !key) return result(503, { error: "not_configured" });
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
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid history");
    return data;
  }
  try {
    const auth = await cloud("/auth/v1/user");
    if (!auth.ok)
      return result([401, 403].includes(auth.status) ? 401 : 503, { error: "session_unavailable" });
    const user = await auth.json();
    if (!user.id) return result(401, { error: "unauthorized" });
    const membership = await read("members", {
      select: "user_id,household_id",
      user_id: `eq.${user.id}`,
    });
    const household = membership.find((member) => member.user_id === user.id)?.household_id;
    if (!household) return result(403, { error: "membership_required" });
    const members = await read("members", {
      select: "user_id,household_id",
      household_id: `eq.${household}`,
      order: "created_at.asc",
    });
    const viewers = members.filter((m) => m.household_id === household).map((m) => m.user_id);
    if (filters.scopeId !== "together" && !viewers.includes(filters.scopeId))
      return result(403, { error: "invalid_scope" });
    const watches = [];
    let after;
    while (true) {
      const page = await read("watches", {
        select:
          "id,title_id,watchers,seasons,watched_on,title:titles(payload),ratings(user_id,score)",
        household_id: `eq.${household}`,
        order: "id.asc",
        limit: "200",
        ...(after ? { id: `gt.${after}` } : {}),
      });
      if (!page.length) break;
      const next = page.at(-1)?.id;
      if (typeof next !== "string" || (after && next <= after))
        throw new Error("Invalid history cursor");
      watches.push(...page);
      after = next;
    }
    const scoped = filterTasteHistory(watches, filters);
    const scopedViewers = filters.scopeId === "together" ? viewers : [filters.scopeId];
    const context = buildTasteContext(scoped, scopedViewers);
    const counts = {
      historyCount: context.historyCount,
      ratedCount: context.ratedCount,
      missingMetadataCount: context.missingMetadataCount,
    };
    if (!context.metrics.length) return result(200, { ...counts, insights: [] });
    // Authorization and a fresh complete read happen before every cache lookup.
    const cacheKey = createHash("sha256")
      .update(JSON.stringify([base, household, filters, scopedViewers, scoped]))
      .digest("hex");
    const now = Date.now();
    for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
    const cached = cache.get(cacheKey);
    if (cached) return result(200, cached.body);
    // Shared AI budget: discovery and taste analysis use the same atomic household quota.
    const quota = await cloud("/rest/v1/rpc/consume_tonight_request", {}, true);
    if (!quota.ok) return result(503, { error: "usage_unavailable" });
    if ((await quota.json()) !== true) return result(429, { error: "rate_limited" });
    const insights = await generateTasteAnalysis(context, filters, env.OPENAI_API_KEY, deadline);
    const response = { ...counts, insights };
    if (cache.size >= 30) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { body: response, expires: Date.now() + 15 * 60 * 1000 });
    return result(200, response);
  } catch {
    return result(502, { error: "analysis_unavailable" });
  }
}
