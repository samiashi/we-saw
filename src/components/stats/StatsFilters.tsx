import { soloEntries } from "@/lib/analytics";
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
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip small active={yearFilter === "all"} onClick={() => onYear("all")}>
        All time
      </FilterChip>
      {years.map((year) => (
        <FilterChip key={year} small active={yearFilter === year} onClick={() => onYear(year)}>
          {year}
        </FilterChip>
      ))}

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      {(["all", "movie", "tv"] as const).map((option) => (
        <FilterChip
          key={option}
          small
          active={typeFilter === option}
          onClick={() => onType(option)}
        >
          {option === "all" ? "All" : option === "movie" ? "Movies" : "TV"}
        </FilterChip>
      ))}

      <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />

      <FilterChip small active={scopeId === "together"} onClick={() => onScope("together")}>
        Together · {jointCount}
      </FilterChip>
      {people.map((person) => (
        <FilterChip
          key={person.id}
          small
          active={scopeId === person.id}
          onClick={() => onScope(person.id)}
        >
          {nameFor(person.id)} solo · {soloEntries(entries, person.id).length}
        </FilterChip>
      ))}
    </div>
  );
}
