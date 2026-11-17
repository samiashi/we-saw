import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TonightPickCard } from "@/components/TonightPickCard";
import { useTonightPicks } from "@/hooks/useTonightPicks";
import type { Entry, Person, Title, TonightPreferences, TonightResult } from "@/lib/types";

const moods = [
  "Anything",
  "Something light",
  "Something gripping",
  "A little adventure",
  "Make us think",
];

export function TonightPicker({
  titles,
  history,
  people,
  generate,
  onOpen,
}: {
  titles: Title[];
  history: Entry[];
  people: Person[];
  generate: (preferences: TonightPreferences, signal: AbortSignal) => Promise<TonightResult>;
  onOpen: (title: Title) => void;
}) {
  const [mood, setMood] = useState("Anything");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState<TonightPreferences["type"]>("all");
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const preferences = {
    mood: [mood === "Anything" ? "" : mood, detail.trim()].filter(Boolean).join(". "),
    type,
    maxMinutes,
    excluded,
  };
  const state = useTonightPicks({ titles, history, people, preferences, generate });
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const status = statusRef.current;
    const area = status?.closest<HTMLElement>("[data-drawer-scroll-area]");
    if ((state.result || state.error) && status && area) {
      area.scrollTo({
        top:
          area.scrollTop +
          status.getBoundingClientRect().top -
          area.getBoundingClientRect().top -
          64,
        behavior: "auto",
      });
    }
  }, [state.result, state.error]);
  const historyNames = new Map(history.map((entry) => [entry.title.key, entry.title.name]));
  const status = state.loading
    ? "Finding a few good options…"
    : (state.error ??
      (state.result
        ? state.picks.length
          ? `${state.picks.length} ${state.picks.length === 1 ? "pick" : "picks"} from ${state.result.candidateCount} titles considered.`
          : "Nothing looks like a good fit. Try a different mood or loosen your filters."
        : ""));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm leading-relaxed">
        A few choices from your queue, shaped by your ratings and tonight’s mood.
      </p>
      <fieldset
        disabled={state.loading}
        className="flex min-w-0 flex-col gap-4 disabled:opacity-60"
      >
        <div className="flex flex-col gap-2" role="group" aria-labelledby="tonight-mood-label">
          <p id="tonight-mood-label" className="text-sm font-medium">
            What sounds good?
          </p>
          <div className="flex flex-wrap gap-2">
            {moods.map((value) => (
              <Chip
                key={value}
                active={mood === value}
                aria-pressed={mood === value}
                className="min-h-10 px-3 text-sm"
                onClick={() => setMood(value)}
              >
                {value}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm">
            Watch type
            <Select
              value={type}
              onChange={(event) => setType(event.target.value as TonightPreferences["type"])}
            >
              <option value="all">Movies & TV</option>
              <option value="movie">Movies</option>
              <option value="tv">TV</option>
            </Select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Time available
            <Select
              value={maxMinutes ?? ""}
              onChange={(event) =>
                setMaxMinutes(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Any length</option>
              <option value="30">Up to 30 min</option>
              <option value="60">Up to 1 hour</option>
              <option value="90">Up to 90 min</option>
              <option value="120">Up to 2 hours</option>
              <option value="180">Up to 3 hours</option>
            </Select>
          </label>
        </div>
        <p className="text-muted -mt-2 text-xs">
          For TV, time means one episode. Unknown runtimes are excluded when you set a limit.
        </p>
        <label className="flex flex-col gap-2 text-sm" htmlFor="tonight-details">
          Anything else?{" "}
          <span className="text-muted text-xs">
            Optional — a mood, theme, or something to avoid
          </span>
          <Textarea
            id="tonight-details"
            rows={2}
            maxLength={400}
            value={detail}
            placeholder="A clever mystery, but nothing too bleak…"
            onChange={(event) => setDetail(event.target.value)}
          />
        </label>
      </fieldset>
      <div className="flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={state.loading || !state.eligible.length}
          onClick={() => void state.findPicks()}
        >
          <Sparkles size={16} />
          {state.loading ? "Finding picks…" : "Find picks"}
        </Button>
        {state.loading ? (
          <Button variant="ghost" onClick={state.cancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-muted text-xs leading-relaxed">
        Uses OpenAI to consider queue details, recent ratings, and your request. Diary notes and
        account details stay out. AI suggestions can miss the mark; review title details for
        anything you need to avoid.
      </p>
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-muted scroll-mt-16 text-sm empty:hidden"
      >
        {status}
      </p>
      {state.error ? (
        <p className="text-muted text-xs">
          Mood preferences were not applied to these fallback picks. Type and time filters still
          apply.
        </p>
      ) : null}
      {!state.eligible.length ? (
        <p className="text-muted text-sm">
          {titles.length
            ? "No queued titles fit these filters. Try more time, a different type, or reset skipped titles."
            : "Add a few titles to Up Next to find your next watch."}
        </p>
      ) : null}
      {excluded.length ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setExcluded([])}>
          Reset skipped titles
        </Button>
      ) : null}
      {state.picks.map((pick, index) => {
        const title = titles.find((title) => title.key === pick.key);
        return title ? (
          <TonightPickCard
            key={pick.key}
            title={title}
            pick={pick}
            index={index}
            evidence={pick.evidence
              .map((key) => historyNames.get(key))
              .filter((name): name is string => Boolean(name))}
            onOpen={() => onOpen(title)}
            onSkip={() => setExcluded((current) => [...current, pick.key])}
          />
        ) : null;
      })}
    </div>
  );
}
