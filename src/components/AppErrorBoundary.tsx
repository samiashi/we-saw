import type { ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[20px] border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">Something broke</h1>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent/90"
            onClick={resetErrorBoundary}
          >
            Try again
          </button>
          <button
            type="button"
            className="h-11 rounded-xl border border-line px-4 text-sm font-semibold transition-colors hover:bg-surface-2"
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
