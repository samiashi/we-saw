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
  history,
  people,
  generate,
  onOpen,
}: {
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
  const state = useTonightPicks({ history, people, preferences, generate });
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
          ? `${state.picks.length} ${state.picks.length === 1 ? "pick" : "picks"} from ${state.result.candidateCount} unseen titles, informed by ${state.result.historyCount} logged watches (${state.result.ratedCount} rated).`
          : state.result.historyCount === 0
            ? "Log and rate a few watches first so we can learn your taste."
            : "No new picks fit this request. Try different filters or reset skipped titles."
        : ""));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted">
        Discover movies and shows through your full watch history: ratings, genres, actors,
        directors and more. Add a mood if you have one.
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
        <p className="-mt-2 text-xs text-muted">
          For TV, time means one episode. Unknown runtimes are excluded when you set a limit.
        </p>
        <label className="flex flex-col gap-2 text-sm" htmlFor="tonight-details">
          Anything else?{" "}
          <span className="text-xs text-muted">
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
        <Button className="flex-1" disabled={state.loading} onClick={() => void state.findPicks()}>
          <Sparkles size={16} />
          {state.loading ? "Finding picks…" : "Find picks"}
        </Button>
        {state.loading ? (
          <Button variant="ghost" onClick={state.cancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Uses OpenAI with taste patterns from your full history, selected rated examples, catalog
        details, and your request. Each person’s ratings stay separate. Diary notes and account
        details stay out. AI suggestions can miss the mark; review title details for anything you
        need to avoid.
      </p>
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="scroll-mt-16 text-sm text-muted empty:hidden"
      >
        {status}
      </p>
      {excluded.length ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setExcluded([])}>
          Reset skipped titles
        </Button>
      ) : null}
      {state.picks.map((pick, index) => {
        const title = state.titles.find((title) => title.key === pick.key);
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
            onSkip={() => setExcluded((current) => [...current, pick.key].slice(-100))}
          />
        ) : null;
      })}
    </div>
  );
}
