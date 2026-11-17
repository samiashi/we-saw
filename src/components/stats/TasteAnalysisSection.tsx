import { TasteAnalysisPanel } from "@/components/stats/TasteAnalysisPanel";
import { useStore } from "@/hooks/useStore";
import type { TasteFilters } from "@/lib/types";

export function TasteAnalysisSection({ filters }: { filters: TasteFilters }) {
  const { entries, people, household, userId, nameFor, requestTasteAnalysis } = useStore();
  // Remount on filters, identity, or data changes: cancel in-flight requests and
  // never label an old report as analysis of newly selected filters/history.
  const revision = JSON.stringify([
    household?.id,
    userId,
    filters,
    people,
    entries.map((entry) => [
      entry.watch.id,
      entry.watch.watchers,
      entry.watch.watchedOn,
      entry.watch.seasonNumbers,
      entry.scores,
      entry.title,
    ]),
  ]);
  return (
    <TasteAnalysisPanel
      key={revision}
      filters={filters}
      scopeLabel={filters.scopeId === "together" ? "Together" : `${nameFor(filters.scopeId)} solo`}
      nameFor={nameFor}
      generate={requestTasteAnalysis}
    />
  );
}
