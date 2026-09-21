import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { readInviteCode } from "@/lib/invite";
import { useStore } from "@/lib/store";

export function SignInGate() {
  const { auth } = useStore();
  const invited = Boolean(readInviteCode());

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
        {auth.authMessage ? <p className="text-bad text-sm">{auth.authMessage}</p> : null}
      </div>
    </div>
  );
}
