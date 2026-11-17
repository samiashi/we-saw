// Build bounded, anonymous model context from EVERY logged watch. This is request
// preparation, not a second user-facing prediction engine. Raw maps remain complete
// so a candidate's less-common credits are not lost in the prompt's summary limits.
const string = (value, limit) => (typeof value === "string" ? value.slice(0, limit) : "");
const names = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string" && v).map((v) => v.slice(0, 120)))]
    : [];
export const validKey = (key) => typeof key === "string" && /^(movie|tv):[1-9]\d*$/.test(key);

export function compactTitle(payload, key = payload?.key) {
  if (!payload || !validKey(key) || !key.startsWith(`${payload.type}:`) || !payload.name)
    return null;
  return {
    key,
    name: string(payload.name, 160),
    type: payload.type,
    year: string(payload.year, 4),
    overview: string(payload.overview, 600),
    genres: names(payload.genres),
    cast: names(payload.cast),
    directors: names(payload.directors),
    originalLanguage: string(payload.originalLanguage, 12),
    countries: names(payload.countries),
    runtimeMinutes:
      Number.isFinite(payload.runtimeMinutes) && payload.runtimeMinutes > 0
        ? payload.runtimeMinutes
        : null,
  };
}

function features(title) {
  const runtime = title.runtimeMinutes;
  return {
    genres: title.genres,
    cast: title.cast,
    directors: title.directors,
    type: [title.type],
    languages: title.originalLanguage ? [title.originalLanguage] : [],
    countries: title.countries,
    decades: /^\d{4}$/.test(title.year) ? [`${Math.floor(Number(title.year) / 10) * 10}s`] : [],
    runtime: runtime
      ? [
          runtime <= 30
            ? "Up to 30 min"
            : runtime <= 60
              ? "31–60 min"
              : runtime <= 120
                ? "61–120 min"
                : "Over 120 min",
        ]
      : [],
  };
}
const average = ({ sum, count }) => Math.round((sum / count) * 100) / 100;
const strength = (stat, mean) => (stat.sum - stat.count * mean) / (stat.count + 2);

export function buildTonightContext(watches, viewers) {
  const history = watches.flatMap((watch) => {
    const title = compactTitle(watch.title?.payload, watch.title_id);
    if (!title) return [];
    const ratings = Object.fromEntries(
      viewers.flatMap((id, index) => {
        const rating = (watch.ratings ?? []).find(
          (r) =>
            r.user_id === id &&
            watch.watchers?.includes(id) &&
            Number.isInteger(r.score) &&
            r.score >= 1 &&
            r.score <= 10,
        );
        return rating ? [[`Viewer ${index + 1}`, rating.score]] : [];
      }),
    );
    return [
      {
        ...title,
        overview: undefined,
        scope: watch.watchers?.length > 1 ? "together" : "solo",
        seasons: watch.seasons ?? null,
        ratings,
      },
    ];
  });
  const profiles = viewers.map((_, index) => {
    const viewer = `Viewer ${index + 1}`;
    const rated = history.filter((watch) => watch.ratings[viewer] !== undefined);
    const mean = rated.length
      ? rated.reduce((sum, watch) => sum + watch.ratings[viewer], 0) / rated.length
      : 0;
    const facets = {};
    for (const watch of rated) {
      for (const [facet, values] of Object.entries(features(watch))) {
        facets[facet] ??= new Map();
        for (const value of values) {
          const stat = facets[facet].get(value) ?? { sum: 0, count: 0 };
          stat.sum += watch.ratings[viewer];
          stat.count += 1;
          facets[facet].set(value, stat);
        }
      }
    }
    return { viewer, count: rated.length, mean, facets };
  });
  function summarizeFacet(profile, entries) {
    return entries.map(([name, stat]) => ({
      name,
      count: stat.count,
      meanRating: average(stat),
      relativePreference: Math.round(strength(stat, profile.mean) * 100) / 100,
    }));
  }
  const taste = profiles.map((profile) => ({
    viewer: profile.viewer,
    ratedWatches: profile.count,
    meanRating: Math.round(profile.mean * 100) / 100,
    facets: Object.fromEntries(
      Object.entries(profile.facets).map(([facet, map]) => {
        const ordered = [...map].sort(
          (a, b) =>
            strength(b[1], profile.mean) - strength(a[1], profile.mean) ||
            b[1].count - a[1].count ||
            a[0].localeCompare(b[0]),
        );
        const selected = new Map([...ordered.slice(0, 12), ...ordered.slice(-8)]);
        return [facet, summarizeFacet(profile, [...selected])];
      }),
    ),
  }));
  // Rotate viewers and media types, so a large movie history cannot crowd out TV
  // or the other person's taste. Low-rated titles never become positive seeds.
  const seedLists = profiles.flatMap((profile) =>
    ["movie", "tv"].map((type) =>
      history
        .filter(
          (watch) =>
            watch.type === type && watch.ratings[profile.viewer] >= Math.max(7, profile.mean),
        )
        .sort(
          (a, b) =>
            b.ratings[profile.viewer] - a.ratings[profile.viewer] || a.key.localeCompare(b.key),
        ),
    ),
  );
  const seeds = new Map();
  for (let i = 0; i < 6; i++)
    for (const list of seedLists) if (list[i] && seeds.size < 6) seeds.set(list[i].key, list[i]);
  const preferred = (facet) => {
    const lists = profiles.map((profile) =>
      [...(profile.facets[facet] ?? [])]
        .filter(([, stat]) => average(stat) >= Math.max(7, profile.mean))
        .sort(
          (a, b) =>
            strength(b[1], profile.mean) - strength(a[1], profile.mean) || b[1].count - a[1].count,
        ),
    );
    const values = new Set();
    for (let i = 0; i < 3; i++) for (const list of lists) if (list[i]) values.add(list[i][0]);
    return [...values];
  };
  function candidateTaste(title) {
    return profiles.map((profile) => ({
      viewer: profile.viewer,
      facets: Object.fromEntries(
        Object.entries(features(title)).map(([facet, values]) => [
          facet,
          summarizeFacet(
            profile,
            values.flatMap((name) => {
              const stat = profile.facets[facet]?.get(name);
              return stat ? [[name, stat]] : [];
            }),
          ),
        ]),
      ),
    }));
  }
  function evidence(candidates) {
    const matches = new Set(
      candidates.flatMap((title) => [...title.cast, ...title.directors, ...title.genres]),
    );
    const relevance = (watch) =>
      [...watch.cast, ...watch.directors, ...watch.genres].filter((name) => matches.has(name))
        .length;
    const selected = new Set(seeds.values());
    for (const profile of profiles) {
      const rated = history.filter((watch) => watch.ratings[profile.viewer] !== undefined);
      // Include explicit dislikes as well as the strongest relevant positive evidence.
      for (const watch of [...rated]
        .sort((a, b) => a.ratings[profile.viewer] - b.ratings[profile.viewer])
        .slice(0, 8))
        selected.add(watch);
      for (const watch of [...rated]
        .sort(
          (a, b) =>
            relevance(b) - relevance(a) || b.ratings[profile.viewer] - a.ratings[profile.viewer],
        )
        .slice(0, 20))
        selected.add(watch);
    }
    return [...selected].slice(0, 64);
  }
  return {
    seen: new Set(watches.map((watch) => watch.title_id)),
    historyCount: watches.length,
    ratedCount: history.filter((watch) => Object.keys(watch.ratings).length).length,
    taste,
    seeds: [...seeds.values()],
    preferred,
    candidateTaste,
    evidence,
  };
}
