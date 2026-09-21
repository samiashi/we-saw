import type { ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="border-line bg-surface flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[20px] border p-6 text-center">
        <h1 className="text-xl font-bold">Something broke</h1>
        <p className="text-muted text-sm">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="bg-accent text-accent-ink hover:bg-accent/90 h-11 rounded-xl px-4 text-sm font-semibold transition-colors"
            onClick={resetErrorBoundary}
          >
            Try again
          </button>
          <button
            type="button"
            className="border-line hover:bg-surface-2 h-11 rounded-xl border px-4 text-sm font-semibold transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallbackRender={ErrorFallback}>{children}</ErrorBoundary>;
}
