import { cn } from "@/lib/utils";

export function scoreBand(score: number): "low" | "mid" | "high" {
  if (score <= 4) return "low";
  if (score <= 7) return "mid";
  return "high";
}

const chipColors = {
  low: "border-bad/45 bg-bad/15 text-[#ffb0a6]",
  mid: "border-accent/45 bg-accent/15 text-[#f3d493]",
  high: "border-good/45 bg-good/15 text-[#a7e8c0]",
} as const;

export function ScoreChip({ score, label }: { score: number | null | undefined; label?: string }) {
  if (score == null) {
    return (
      <span className="border-line text-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] whitespace-nowrap">
        {label ? `${label} —` : "—"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
        chipColors[scoreBand(score)],
      )}
    >
      {label ? `${label} ${score}` : score}
    </span>
  );
}
