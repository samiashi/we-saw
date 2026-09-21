import { useMemo } from "react";
import { activityHeatmap } from "@/lib/analytics";
import type { Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS = ["bg-surface-2", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function ActivityHeatmap({ entries, weeks = 53 }: { entries: Entry[]; weeks?: number }) {
  const { weeks: grid, activeDays } = useMemo(
    () => activityHeatmap(entries, weeks),
    [entries, weeks],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[3px] overflow-x-auto pt-4 pb-1">
        {grid.map((week, weekIndex) => (
          <div key={week.days[0]?.date ?? weekIndex} className="relative flex flex-col gap-[3px]">
            {week.monthLabel ? (
              <span className="text-muted absolute -top-4 left-0 text-[10px] whitespace-nowrap">
                {week.monthLabel}
              </span>
            ) : null}
            {week.days.map((day, dayIndex) => (
              <div
                key={day?.date ?? `${weekIndex}-${dayIndex}`}
                title={
                  day
                    ? `${day.date}: ${day.count} ${day.count === 1 ? "watch" : "watches"}`
                    : undefined
                }
                className={cn(
                  "size-[10px] rounded-[3px]",
                  day ? LEVELS[level(day.count)] : "bg-transparent",
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="text-muted flex items-center justify-between text-[11px]">
        <span>{activeDays} active days</span>
        <span className="flex items-center gap-1">
          Less
          {LEVELS.map((cls) => (
            <span key={cls} className={cn("size-[10px] rounded-[3px]", cls)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
