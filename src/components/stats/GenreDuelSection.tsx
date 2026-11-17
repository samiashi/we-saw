import type { GenreGap } from "@/lib/analytics";

export function GenreDuelSection({
  duels,
  duelMax,
  pairNames,
  onDrill,
}: {
  duels: GenreGap[];
  duelMax: number;
  pairNames: [string, string];
  onDrill: (genre: string) => void;
}) {
  if (!duels.length) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Genre duel</h2>
        <span className="text-[13px] text-muted">
          {pairNames[0]} vs {pairNames[1]} · joint watches
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {duels.map((row) => (
          <button
            key={row.name}
            type="button"
            className="grid grid-cols-[minmax(90px,1fr)_2fr_auto] items-center gap-2.5 text-[13.5px]"
            onClick={() => onDrill(row.name)}
          >
            <span className="truncate text-left">{row.name}</span>
            <span className="flex h-2.5 items-center gap-0.5">
              <span className="flex h-full flex-1 justify-end overflow-hidden rounded-l-full bg-surface-2">
                {row.gap < 0 ? (
                  <span
                    className="h-full rounded-l-full bg-[#a48cff]"
                    style={{ width: `${(Math.abs(row.gap) / duelMax) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="flex h-full flex-1 overflow-hidden rounded-r-full bg-surface-2">
                {row.gap > 0 ? (
                  <span
                    className="h-full rounded-r-full bg-accent"
                    style={{ width: `${(Math.abs(row.gap) / duelMax) * 100}%` }}
                  />
                ) : null}
              </span>
            </span>
            <span className="text-xs whitespace-nowrap text-muted">
              {row.avgA} vs {row.avgB}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
