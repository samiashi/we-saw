import { cn } from "@/lib/utils";
import { scoreBand } from "@/components/ScoreChip";

const pillFills = {
  low: "border-transparent bg-bad/75 text-[#2a0f0c]",
  mid: "border-transparent bg-accent/80 text-accent-ink",
  high: "border-transparent bg-good/80 text-[#08210f]",
} as const;

export function RatingPicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="grid grid-cols-10 gap-1" role="group" aria-label={ariaLabel}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => {
        const filled = value != null && score <= value;
        return (
          <button
            key={score}
            type="button"
            className={cn(
              "border-line bg-surface text-muted h-10 rounded-lg border text-[13px] font-semibold transition-colors",
              filled && pillFills[scoreBand(score)],
              value === score && "ring-ink/80 ring-2",
              disabled && "cursor-default opacity-45",
              disabled && filled && "opacity-70",
            )}
            aria-pressed={value === score}
            onClick={() => onChange(score)}
            disabled={disabled}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}
