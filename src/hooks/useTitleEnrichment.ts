import { useState } from "react";
import { fetchTitleDetails, titleToSummary } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/useToast";

export function useTitleEnrichment() {
  const { titles, patchTitle } = useStore();
  const toast = useToast();
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);

  const missingCount = Object.values(titles).filter(
    (title) => title.tmdbId && !title.originalLanguage,
  ).length;

  async function enrich() {
    const missing = Object.values(titles)
      .filter((title) => title.tmdbId && !title.originalLanguage)
      .slice(0, 40);
    if (!missing.length) return;

    setEnriching(true);
    setProgress(0);

    let done = 0;
    let misses = 0;

    for (const title of missing) {
      const details = await fetchTitleDetails(titleToSummary(title));
      if (details?.originalLanguage) {
        await patchTitle(title.key, {
          originalLanguage: details.originalLanguage,
          countries: details.countries ?? [],
        });
        misses = 0;
      } else {
        misses += 1;
        if (misses >= 3) break;
      }
      done += 1;
      setProgress(done);
    }

    setEnriching(false);
    toast.show(done ? `Updated ${done} titles.` : "No metadata available — check your TMDB key.");
  }

  return { missingCount, enriching, progress, enrich };
}
