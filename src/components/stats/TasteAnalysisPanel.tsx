import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TasteInsightCard } from "@/components/stats/TasteInsightCard";
import type { TasteFilters, TasteResult } from "@/lib/types";

export function TasteAnalysisPanel({
  filters,
  scopeLabel,
  nameFor,
  generate,
}: {
  filters: TasteFilters;
  scopeLabel: string;
  nameFor: (id: string) => string;
  generate: (filters: TasteFilters, signal: AbortSignal) => Promise<TasteResult>;
}) {
  const [result, setResult] = useState<TasteResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
  }
  async function analyze() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timer = window.setTimeout(() => request.abort(), 55000);
    setLoading(true);
    setError("");
    try {
      const response = await generate(filters, request.signal);
      if (controller.current === request && !request.signal.aborted) setResult(response);
    } catch (cause) {
      if (controller.current === request)
        setError(
          request.signal.aborted
            ? "That took too long. Please try again."
            : cause instanceof Error
              ? cause.message
              : "Could not analyze your taste. Please try again.",
        );
    } finally {
      window.clearTimeout(timer);
      if (controller.current === request) setLoading(false);
    }
  }
  return (
    <section
      aria-label="Taste analysis"
      className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4"
    >
      <div>
        <h2 className="text-[17px] font-semibold">Understand your taste</h2>
        <p className="mt-1 text-xs text-muted">
          {scopeLabel} · {filters.year === "all" ? "All time" : filters.year} ·{" "}
          {filters.type === "all" ? "Movies & TV" : filters.type === "movie" ? "Movies" : "TV"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => void analyze()}>
          <Sparkles size={16} />
          {loading ? "Analyzing…" : result ? "Refresh analysis" : "Analyze my taste"}
        </Button>
        {loading ? (
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted empty:hidden">
        {loading
          ? "Reading your history and looking for patterns…"
          : error ||
            (result
              ? result.insights.length
                ? `Based on all ${result.historyCount} matching watches (${result.ratedCount} rated).`
                : result.historyCount
                  ? "Not enough repeated ratings to identify a pattern yet. Rate more watches or broaden your filters."
                  : "No watches match these filters. Try another scope, year, or watch type."
              : "")}
      </p>
      {result?.missingMetadataCount ? (
        <p className="text-xs text-muted">
          {result.missingMetadataCount} watches have missing title details and could not contribute
          to taste patterns.
        </p>
      ) : null}
      {result?.insights.map((insight, index) => (
        <TasteInsightCard key={index} insight={insight} nameFor={nameFor} />
      ))}
    </section>
  );
}
