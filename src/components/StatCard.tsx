import { useCountUp } from "@/hooks/useCountUp";

export function StatCard({
  value,
  label,
  format,
}: {
  value: number | null;
  label: string;
  format?: (value: number) => string;
}) {
  const animated = useCountUp(value);
  const display = animated == null ? "—" : format ? format(animated) : String(Math.round(animated));

  return (
    <div className="border-line bg-surface flex flex-col gap-1 rounded-2xl border p-3.5">
      <span className="text-[22px] font-bold tracking-tight">{display}</span>
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}
