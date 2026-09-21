import { useStore } from "@/lib/store";
import type { Person } from "@/lib/types";
import { Distribution } from "@/components/stats/Distribution";

export interface PersonHistoryRow {
  person: Person;
  stats: { count: number; avg: number | null };
  distribution: { score: number; count: number }[];
}

export function RatingHabitsSection({
  personHistory,
  note,
}: {
  personHistory: PersonHistoryRow[];
  note: string;
}) {
  const { nameFor } = useStore();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Rating habits</h2>
        <span className="text-muted text-[13px]">{note}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {personHistory.map(({ person, stats, distribution }) => (
          <div key={person.id} className="flex flex-col gap-1.5">
            <span className="text-[13px]">
              {nameFor(person.id)}{" "}
              <span className="text-muted">
                avg {stats.avg ?? "—"} · {stats.count} rated
              </span>
            </span>
            <Distribution buckets={distribution} />
          </div>
        ))}
      </div>
    </section>
  );
}
