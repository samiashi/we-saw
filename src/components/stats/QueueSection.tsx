import type { QueueStats } from "@/lib/analytics";
import { StatCard } from "@/components/StatCard";

export function QueueSection({
  queue,
  oldestName,
}: {
  queue: QueueStats;
  oldestName: string | null;
}) {
  const hasItems = queue.finished || queue.dropped || queue.queued || queue.watching;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Queue health</h2>
        <span className="text-muted text-[13px]">All time</span>
      </div>
      {hasItems ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            <StatCard
              value={queue.medianLagDays}
              label="Median days to watch"
              format={(value) => `${Math.round(value)}d`}
            />
            <StatCard
              value={queue.oldestWaitingDays}
              label="Oldest waiting"
              format={(value) => `${Math.round(value)}d`}
            />
            <StatCard
              value={queue.abandonedShare}
              label="Abandoned"
              format={(value) => `${Math.round(value)}%`}
            />
          </div>
          <p className="text-muted text-[13px]">
            {oldestName ? `Longest wait: ${oldestName}. ` : ""}
            {queue.finished} finished · {queue.dropped} dropped · {queue.queued} queued ·{" "}
            {queue.watching} in progress
          </p>
        </>
      ) : (
        <p className="text-muted text-[13px]">Nothing on the list yet.</p>
      )}
    </section>
  );
}
