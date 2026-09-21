import { lazy, Suspense, useState } from "react";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { readInviteCode } from "@/lib/invite";
import { useStore } from "@/lib/store";

const DemoPreview = lazy(() =>
  import("@/views/DemoPreview").then((module) => ({ default: module.DemoPreview })),
);

export function SignInGate() {
  const { auth } = useStore();
  const [demoOpen, setDemoOpen] = useState(false);
  const invited = Boolean(readInviteCode());

  if (demoOpen) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center p-6">
            <Skeleton className="h-64 w-full max-w-[420px]" />
          </div>
        }
      >
        <DemoPreview
          onClose={() => setDemoOpen(false)}
          onSignIn={() => void auth.signInWithGoogle()}
        />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="border-line bg-surface flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[20px] border p-7 text-center">
        <LogoLockup />
        {invited ? (
          <p className="text-good text-sm font-medium">
            You've been invited — sign in to join the household.
          </p>
        ) : (
          <p className="text-muted text-sm">A shared movie and TV diary for the two of you.</p>
        )}
        <ul className="text-muted flex flex-col gap-1.5 text-left text-[13px]">
          <li>Rate what you watch together — 1 to 10 each</li>
          <li>Taste match, streaks and a year in review</li>
          <li>Private: only your household sees your data</li>
        </ul>
        <Button
          className="w-full"
          onClick={() => void auth.signInWithGoogle()}
          disabled={auth.isAuthLoading}
        >
          Continue with Google
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setDemoOpen(true)}>
          See a sample household
        </Button>
        {auth.authMessage ? <p className="text-bad text-sm">{auth.authMessage}</p> : null}
      </div>
    </div>
  );
}
