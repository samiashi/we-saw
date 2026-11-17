import { useEffect, useRef, useState } from "react";
import { filterTonightTitles } from "@/lib/analytics";
import type { Entry, Person, TonightPreferences, TonightResult } from "@/lib/types";

export function useTonightPicks({
  history,
  people,
  preferences,
  generate,
}: {
  history: Entry[];
  people: Person[];
  preferences: TonightPreferences;
  generate: (preferences: TonightPreferences, signal: AbortSignal) => Promise<TonightResult>;
}) {
  const [response, setResponse] = useState<{
    key: string;
    result?: TonightResult;
    error?: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  // Changed history, ratings, viewers, or controls invalidate earlier responses.
  const contextKey = JSON.stringify([
    [preferences.mood, preferences.type, preferences.maxMinutes],
    history.map((e) => [e.watch.id, e.watch.watchers, e.scores, e.title]),
    people.map((p) => p.id),
  ]);
  const key = JSON.stringify([contextKey, preferences.excluded]);
  useEffect(
    () => () => {
      controller.current?.abort();
      requestId.current += 1;
    },
    [key],
  );
  const current = response?.key === contextKey ? response : null;
  const loading = pendingKey === key;
  const titles = filterTonightTitles(current?.result?.titles ?? [], preferences);
  const picks = (current?.result?.picks ?? []).filter((pick) =>
    titles.some((title) => title.key === pick.key),
  );

  function cancel() {
    controller.current?.abort();
    requestId.current += 1;
    setPendingKey(null);
  }

  async function findPicks() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++requestId.current;
    setPendingKey(key);
    setResponse(null);
    const timer = window.setTimeout(() => abort.abort(), 55000);
    try {
      const result = await generate(preferences, abort.signal);
      if (requestId.current === id && !abort.signal.aborted)
        setResponse({ key: contextKey, result });
    } catch (error) {
      if (requestId.current === id)
        setResponse({
          key: contextKey,
          error: abort.signal.aborted
            ? "That took too long. Please try again."
            : error instanceof Error
              ? error.message
              : "Recommendations are unavailable. Please try again.",
        });
    } finally {
      window.clearTimeout(timer);
      if (requestId.current === id) setPendingKey(null);
    }
  }
  return {
    loading,
    picks,
    error: current?.error,
    result: current?.result,
    titles,
    findPicks,
    cancel,
  };
}
