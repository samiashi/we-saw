import { lazy, Suspense, useEffect, useState } from "react";
import { BarChart3, History as HistoryIcon, ListVideo, PlusCircle, Settings } from "lucide-react";
import { OnboardingGate } from "@/components/OnboardingGate";
import { SetupGate } from "@/components/SetupGate";
import { SignInGate } from "@/components/SignInGate";
import { StartChecklist } from "@/components/StartChecklist";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewTransition } from "@/hooks/useViewTransition";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import { HistoryView } from "@/views/HistoryView";
import { LogView } from "@/views/LogView";
import { SettingsView } from "@/views/SettingsView";
import { UpNextView } from "@/views/UpNextView";

const StatsView = lazy(() =>
  import("@/views/StatsView").then((module) => ({ default: module.StatsView })),
);

type Tab = "log" | "upnext" | "history" | "stats" | "settings";

const tabs: { id: Tab; label: string; icon: typeof PlusCircle }[] = [
  { id: "log", label: "Log", icon: PlusCircle },
  { id: "upnext", label: "Up Next", icon: ListVideo },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const {
    ready,
    signedOut,
    needsOnboarding,
    partnerJoined,
    clearPartnerJoined,
    people,
    userId,
    syncError,
    clearSyncError,
    refresh,
  } = useStore();
  const [tab, setTab] = useState<Tab>("log");
  const [retrying, setRetrying] = useState(false);
  const transition = useViewTransition();

  function selectTab(next: Tab) {
    transition(() => {
      setTab(next);
      window.scrollTo(0, 0);
    });
  }

  useEffect(() => {
    const prefetch = () => void import("@/views/StatsView");
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 3000);
    return () => clearTimeout(timer);
  }, []);

  async function retryLoad() {
    setRetrying(true);
    await refresh();
    setRetrying(false);
  }

  if (!isSupabaseConfigured) return <SetupGate />;
  if (signedOut) return <SignInGate />;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">
            {syncError ? "Could not load your log." : "Loading your log…"}
          </p>
          {syncError ? (
            <>
              <p className="text-[13px] text-bad">{syncError}</p>
              <Button onClick={() => void retryLoad()} disabled={retrying}>
                {retrying ? "Trying…" : "Try again"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    );
  }
  if (needsOnboarding) return <OnboardingGate />;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-[720px] px-4 pt-5 pb-[108px]">
        {partnerJoined ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-good/40 bg-good/10 px-4 py-3 text-[14px]">
            <span>
              {people.find((person) => person.id !== userId)?.name ?? "Your partner"} joined your
              household
            </span>
            <Button variant="ghost" size="sm" onClick={clearPartnerJoined}>
              Dismiss
            </Button>
          </div>
        ) : null}

        <StartChecklist onNavigate={selectTab} />

        {tab === "log" ? <LogView /> : null}
        {tab === "upnext" ? <UpNextView /> : null}
        {tab === "history" ? <HistoryView /> : null}
        {tab === "stats" ? (
          <Suspense
            fallback={
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            }
          >
            <StatsView />
          </Suspense>
        ) : null}
        {tab === "settings" ? <SettingsView /> : null}
      </main>

      {syncError ? (
        <div
          role="status"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-60 flex max-w-[min(92vw,480px)] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-bad/40 bg-surface-2 px-3.5 py-2.5 text-[13px]"
        >
          <span>{syncError}</span>
          <Button variant="ghost" size="sm" onClick={clearSyncError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-1 border-t border-line bg-[rgba(14,15,19,0.86)] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              "flex max-w-[110px] flex-1 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] text-muted transition-colors",
              tab === id && "bg-accent/8 text-accent",
            )}
            onClick={() => selectTab(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
