export function Toast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="border-line bg-surface-2 fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-60 max-w-[min(92vw,480px)] -translate-x-1/2 rounded-xl border px-3.5 py-2.5 text-[13px]"
    >
      {message}
    </div>
  );
}
