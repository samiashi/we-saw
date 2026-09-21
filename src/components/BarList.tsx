import type { StatRow } from "@/lib/analytics";

export function BarList({ rows }: { rows: StatRow[] }) {
  if (!rows.length) return <p className="text-muted text-[13px]">Not enough data yet.</p>;
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(90px,1.1fr)_2fr_auto] items-center gap-2.5 text-[13.5px]"
        >
          <span className="truncate">{row.name}</span>
          <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
            <div
              className="to-accent h-full rounded-full bg-gradient-to-r from-[#8f6f2a]"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="text-muted text-xs whitespace-nowrap">
            {row.count}
            {row.avg != null ? ` · ${row.avg}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
