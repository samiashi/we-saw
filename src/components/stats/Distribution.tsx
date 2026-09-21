import { cn } from "@/lib/utils";
import { scoreBand } from "@/components/ScoreChip";

export function Distribution({ buckets }: { buckets: { score: number; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="flex h-[110px] items-end gap-1.5 px-0.5">
      {buckets.map((bucket) => (
        <div
          key={bucket.score}
          className="flex h-full flex-1 flex-col items-center gap-1.5"
          title={`${bucket.score}: ${bucket.count}`}
        >
          <div className="border-line bg-surface flex w-full flex-1 items-end overflow-hidden rounded-md border">
            <div
              className={cn(
                "w-full rounded-t-md",
                scoreBand(bucket.score) === "low" && "bg-bad",
                scoreBand(bucket.score) === "mid" && "bg-accent",
                scoreBand(bucket.score) === "high" && "bg-good",
              )}
              style={{ height: `${(bucket.count / max) * 100}%`, minHeight: 2 }}
            />
          </div>
          <span className="text-muted text-[10.5px]">{bucket.score}</span>
        </div>
      ))}
    </div>
  );
}
