import { useStore } from "@/lib/store";
import type { Prediction } from "@/lib/analytics";

export function PredictionChips({ predictions }: { predictions: Prediction[] }) {
  const { people, nameFor } = useStore();

  return (
    <div className="flex flex-wrap gap-1.5">
      {predictions.map((prediction, index) => (
        <span
          key={people[index]?.id ?? index}
          className="inline-flex items-center rounded-full border border-[#78b4ff]/40 bg-[#78b4ff]/12 px-2.5 py-0.5 text-[11.5px] whitespace-nowrap text-[#bfe3ff]"
        >
          {people[index] ? nameFor(people[index].id) : "?"} {prediction.score}
        </span>
      ))}
    </div>
  );
}
