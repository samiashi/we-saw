import type { Insight } from "@/lib/analytics";

export function InsightsRow({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;

  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="max-w-[280px] min-w-[220px] shrink-0 rounded-2xl border border-accent/30 bg-accent/6 p-3.5 text-[13.5px] leading-snug"
        >
          {insight.text}
        </div>
      ))}
    </div>
  );
}
