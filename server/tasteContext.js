import { buildTonightContext, compactTitle } from "./tonightContext.js";

// All matching watches contribute to the existing full-history taste aggregates.
// Only the model's explanation candidates and examples are bounded, never the input history.
export function buildTasteContext(watches, viewers) {
  const context = buildTonightContext(watches, viewers);
  const rows = watches.flatMap((watch) => {
    const title = compactTitle(watch.title?.payload, watch.title_id);
    return title ? [{ watch, title }] : [];
  });
  const metrics = [];
  const matches = (title, facet, name) => {
    if (["genres", "cast", "directors", "countries"].includes(facet))
      return title[facet].includes(name);
    if (facet === "languages") return title.originalLanguage === name;
    if (facet === "type") return title.type === name;
    if (facet === "decades") return `${Math.floor(Number(title.year) / 10) * 10}s` === name;
    return false;
  };
  for (const [index, profile] of context.taste.entries()) {
    for (const [facet, stats] of Object.entries(profile.facets)) {
      if (facet === "runtime") continue; // Movie and episode runtimes need separate comparisons.
      const supported = stats.filter((stat) => stat.count >= 2);
      const selected = [
        ...new Map(
          [...supported.slice(0, 3), ...supported.slice(-3)].map((s) => [s.name, s]),
        ).values(),
      ];
      for (const stat of selected) {
        const evidence = rows
          .filter(
            ({ watch, title }) =>
              matches(title, facet, stat.name) &&
              watch.watchers?.includes(viewers[index]) &&
              watch.ratings?.some(
                (r) =>
                  r.user_id === viewers[index] &&
                  Number.isInteger(r.score) &&
                  r.score >= 1 &&
                  r.score <= 10,
              ),
          )
          .sort((a, b) => a.watch.id.localeCompare(b.watch.id));
        metrics.push({
          id: `m${metrics.length}`,
          viewer: profile.viewer,
          viewerId: viewers[index],
          facet,
          ...stat,
          evidence: evidence.slice(0, 4).map(({ watch, title }) => ({
            id: watch.id,
            name: title.name,
            titleKey: title.key,
            posterPath: watch.title.payload.posterPath ?? null,
            watchedOn: watch.watched_on ?? null,
            ratings: Object.fromEntries(
              (watch.ratings ?? [])
                .filter(
                  (r) =>
                    viewers.includes(r.user_id) &&
                    watch.watchers.includes(r.user_id) &&
                    Number.isInteger(r.score) &&
                    r.score >= 1 &&
                    r.score <= 10,
                )
                .map((r) => [r.user_id, r.score]),
            ),
          })),
        });
      }
    }
  }
  return {
    historyCount: watches.length,
    ratedCount: context.ratedCount,
    missingMetadataCount: watches.length - rows.length,
    profiles: context.taste.map(({ viewer, ratedWatches, meanRating }) => ({
      viewer,
      ratedWatches,
      meanRating,
    })),
    metrics,
  };
}

export function filterTasteHistory(watches, filters) {
  return watches.filter(
    (watch) =>
      (filters.scopeId === "together"
        ? watch.watchers?.length > 1
        : watch.watchers?.length === 1 && watch.watchers[0] === filters.scopeId) &&
      (filters.year === "all" || watch.watched_on?.startsWith(`${filters.year}-`)) &&
      (filters.type === "all" || watch.title?.payload?.type === filters.type),
  );
}
