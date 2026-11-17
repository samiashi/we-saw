// Candidate IDs always come from TMDB; the model cannot invent a recommendation.
export async function discoverTonight(context, prefs, catalog, signal) {
  const excluded = new Set([...context.seen, ...prefs.excluded]);
  const types = prefs.type === "all" ? ["movie", "tv"] : [prefs.type];
  const fetch = (path, params = {}) => catalog.fetch(path, params, signal);
  const sources = context.seeds.map(async (seed) => {
    const [type, id] = seed.key.split(":");
    const data = await fetch(`/${type}/${id}/recommendations`);
    return (data.results ?? []).map((item) => ({ ...item, media_type: type }));
  });
  // Resolve credit names through the catalog. Ambiguous name matches are skipped.
  for (const [facet, role] of [
    ["cast", "cast"],
    ["directors", "crew"],
  ]) {
    for (const name of context.preferred(facet).slice(0, 2))
      sources.push(
        (async () => {
          const people = await fetch("/search/person", { query: name, include_adult: false });
          const exact = (people.results ?? []).filter(
            (person) => person.name?.toLowerCase() === name.toLowerCase(),
          );
          if (exact.length !== 1) return [];
          const credits = await fetch(`/person/${exact[0].id}/combined_credits`);
          return (credits[role] ?? []).filter(
            (item) => role === "cast" || ["Director", "Creator"].includes(item.job),
          );
        })(),
      );
  }
  for (const type of types)
    sources.push(
      (async () => {
        const genres = await fetch(`/genre/${type}/list`);
        const ids = (genres.genres ?? [])
          .filter((genre) => context.preferred("genres").includes(genre.name))
          .map((genre) => genre.id)
          .slice(0, 4);
        const data = await fetch(`/discover/${type}`, {
          with_genres: ids.join("|"),
          "with_runtime.lte": prefs.maxMinutes,
          "vote_count.gte": 50,
          sort_by: "popularity.desc",
          include_adult: false,
          [type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]: new Date()
            .toISOString()
            .slice(0, 10),
        });
        return (data.results ?? []).map((item) => ({ ...item, media_type: type }));
      })(),
    );
  const settled = await Promise.allSettled(sources);
  signal.throwIfAborted();
  const groups = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) =>
      r.value.filter((item) => {
        const date = item.release_date ?? item.first_air_date;
        return (
          Number.isInteger(item.id) &&
          item.id > 0 &&
          types.includes(item.media_type) &&
          !item.adult &&
          !excluded.has(`${item.media_type}:${item.id}`) &&
          (!date || date <= new Date().toISOString().slice(0, 10))
        );
      }),
    );
  if (!groups.length) throw new Error("Catalog unavailable");
  // Round robin prevents one prolific actor or a single seed from filling the pool.
  const pool = new Map();
  for (let i = 0; i < 40 && pool.size < 24; i++)
    for (const group of groups) {
      const item = group[i];
      if (item && pool.size < 24) pool.set(`${item.media_type}:${item.id}`, item);
    }
  const pending = [...pool.values()];
  const details = [];
  await Promise.all(
    Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length) {
        signal.throwIfAborted();
        const item = pending.shift();
        try {
          details.push({
            status: "fulfilled",
            value: await catalog.details(item.media_type, item.id, signal),
          });
        } catch {
          details.push({ status: "rejected" });
        }
      }
    }),
  );
  signal.throwIfAborted();
  if (pool.size && details.every((r) => r.status === "rejected"))
    throw new Error("Catalog unavailable");
  return details
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter(
      (title) =>
        title &&
        !excluded.has(title.key) &&
        types.includes(title.type) &&
        (prefs.maxMinutes === null ||
          (title.runtimeMinutes > 0 && title.runtimeMinutes <= prefs.maxMinutes)),
    );
}
