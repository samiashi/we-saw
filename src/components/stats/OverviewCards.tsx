import { formatMinutes } from "@/lib/analytics";
import { StatCard } from "@/components/StatCard";

export function OverviewCards({
  movies,
  seasons,
  minutes,
  avg,
}: {
  movies: number;
  seasons: number;
  minutes: number;
  avg: number | null;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
      <StatCard value={movies} label="Movies" />
      <StatCard value={seasons} label="TV seasons" />
      <StatCard value={minutes} label="Watch time" format={formatMinutes} />
      <StatCard value={avg} label="Avg rating" format={(value) => value.toFixed(1)} />
    </div>
  );
}
