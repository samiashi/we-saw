import type { PredictionAccuracy } from "@/lib/analytics";
import { useStore } from "@/lib/store";

export function PredictionsSection({ accuracies }: { accuracies: PredictionAccuracy[] }) {
  const { nameFor } = useStore();

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Prediction accuracy</h2>
        <span className="text-muted text-[13px]">Leave-one-out</span>
      </div>
      {accuracies.some((row) => row.meanAbsoluteError != null) ? (
        <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
          {accuracies.map((row) => (
            <div key={row.personId} className="flex justify-between gap-3 text-[13.5px]">
              <span className="truncate">{nameFor(row.personId)}</span>
              <span className="text-muted whitespace-nowrap">
                {row.meanAbsoluteError != null
                  ? `predicts self within ±${row.meanAbsoluteError} over ${row.count} ratings`
                  : `needs 5 ratings (${row.count})`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-[13px]">
          Rate at least five things to see how predictable you are.
        </p>
      )}
    </section>
  );
}
