import { useEffect, useRef, useState } from "react";
import { buildTasteProfile, filterTonightTitles, rankPicks } from "@/lib/analytics";
import type { Entry, Person, Title, TonightPreferences, TonightResult } from "@/lib/types";

export function useTonightPicks({
  titles,
  history,
  people,
  preferences,
  generate,
}: {
  titles: Title[];
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
  // Changed queue metadata, ratings, viewers, or controls invalidate any earlier response.
  const contextKey = JSON.stringify([
    [preferences.mood, preferences.type, preferences.maxMinutes],
    titles,
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
  const eligible = filterTonightTitles(titles, preferences);
  const current = response?.key === contextKey ? response : null;
  const loading = pendingKey === key;
  const profiles = people.map((person) => buildTasteProfile(history, person.id));
  const ranked = profiles.some((profile) => profile.count > 0)
    ? rankPicks(eligible, profiles).map((pick) => pick.title)
    : eligible;
  const fallback = current?.error
    ? ranked.slice(0, 3).map((title) => ({
        key: title.key,
        reason: profiles.some((p) => p.count > 0)
          ? "From your usual taste ranking."
          : "From your Up Next list.",
        caveat: "",
        evidence: [],
      }))
    : [];
  const picks = (current?.result?.picks ?? fallback).filter((pick) =>
    eligible.some((title) => title.key === pick.key),
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
            ? "That took too long. Your usual taste ranking is below."
            : error instanceof Error
              ? error.message
              : "AI picks are unavailable. Your usual taste ranking is below.",
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
    eligible,
    findPicks,
    cancel,
  };
}
