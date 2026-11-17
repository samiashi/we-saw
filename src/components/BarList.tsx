import type { StatRow } from "@/lib/analytics";

export function BarList({ rows }: { rows: StatRow[] }) {
  if (!rows.length) return <p className="text-[13px] text-muted">Not enough data yet.</p>;
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(90px,1.1fr)_2fr_auto] items-center gap-2.5 text-[13.5px]"
        >
          <span className="truncate">{row.name}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8f6f2a] to-accent"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs whitespace-nowrap text-muted">
            {row.count}
            {row.avg != null ? ` · ${row.avg}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
