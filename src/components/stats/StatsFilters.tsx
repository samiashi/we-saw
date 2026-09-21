import { soloEntries } from "@/lib/analytics";
import { scoreStats } from "@/lib/analytics";
import { makeScorer } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { FilterChip } from "@/components/stats/FilterChip";

export function StatsFilters({
  years,
  yearFilter,
  onYear,
  typeFilter,
  onType,
  scopeId,
  onScope,
  jointCount,
}: {
  years: string[];
  yearFilter: string;
  onYear: (year: string) => void;
  typeFilter: "all" | "movie" | "tv";
  onType: (type: "all" | "movie" | "tv") => void;
  scopeId: string;
  onScope: (scope: string) => void;
  jointCount: number;
}) {
  const { entries, people, nameFor } = useStore();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {["all", ...years].map((year) => (
          <FilterChip key={year} active={yearFilter === year} onClick={() => onYear(year)}>
            {year === "all" ? "All time" : year}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "movie", "tv"] as const).map((option) => (
          <FilterChip key={option} active={typeFilter === option} onClick={() => onType(option)}>
            {option === "all" ? "All" : option === "movie" ? "Movies" : "TV"}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={scopeId === "together"} onClick={() => onScope("together")}>
          Together · {jointCount}
        </FilterChip>
        {people.map((person) => (
          <FilterChip
            key={person.id}
            active={scopeId === person.id}
            onClick={() => onScope(person.id)}
          >
            {nameFor(person.id)} solo · {soloEntries(entries, person.id).length}
          </FilterChip>
        ))}
      </div>
      <p className="text-muted -mt-3 text-[13px]">
        {scopeId === "together"
          ? "Joint watches only, scored with your combined average."
          : `${nameFor(scopeId)}'s solo watches only, scored with their own ratings.`}
      </p>

      <div className="flex flex-wrap gap-2">
        {people.map((person) => {
          const stats = scoreStats(soloEntries(entries, person.id), makeScorer(person.id));
          return (
            <div
              key={person.id}
              className="border-line bg-surface flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5"
            >
              <strong className="text-sm">{nameFor(person.id)}</strong>
              <span className="text-muted text-[13px]">
                {stats.count} solo rated · avg {stats.avg ?? "—"} · {jointCount} joint
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
