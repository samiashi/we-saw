import { useState } from "react";
import { LogoLockup } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearInviteCode, readInviteCode } from "@/lib/invite";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function friendlyError(message: string): string {
  if (/invite code is not valid/i.test(message)) {
    return "That invite code isn't right — double-check it with whoever invited you.";
  }
  if (/valid We Saw invite code/i.test(message)) {
    return "A We Saw invite code is needed to start a household. If you're the first one here, leave it blank.";
  }
  if (/signed in/i.test(message)) return "Your session expired — please sign in again.";
  return "Something went wrong. Try again.";
}

export function OnboardingGate() {
  const { auth, redeemInvite, createHousehold } = useStore();
  const storedInvite = readInviteCode();
  const [mode, setMode] = useState<"join" | "create">("join");
  const [code, setCode] = useState(storedInvite ?? "");
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [appCode, setAppCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError("");
    const message = await redeemInvite(code, name);
    setBusy(false);
    if (message) {
      setError(friendlyError(message));
      return;
    }
    clearInviteCode();
  }

  async function create() {
    setBusy(true);
    setError("");
    const message = await createHousehold(householdName, name, appCode);
    setBusy(false);
    if (message) setError(friendlyError(message));
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="border-line bg-surface flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[20px] border p-6 text-center">
        <LogoLockup size={36} />
        <h1 className="text-xl font-bold">Set up your log</h1>

        {storedInvite ? (
          <p className="text-good text-[13px]">
            You've been invited — the code is filled in below, just add your name.
          </p>
        ) : null}

        <div className="border-line bg-surface flex w-full gap-1.5 rounded-xl border p-1">
          {(
            [
              ["join", "Join with a code"],
              ["create", "Start a household"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "text-muted flex-1 rounded-[9px] px-2.5 py-2 text-[13px] font-semibold transition-colors",
                mode === value && "bg-surface-2 text-ink ring-accent/45 ring-1",
              )}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "join" ? (
          <>
            <p className="text-muted text-[13px]">
              Ask your partner or friend for the code from their We Saw settings.
            </p>
            <Input
              placeholder="Invite code"
              autoCapitalize="characters"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Input
              placeholder="Your name — how they'll see you"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button className="w-full" onClick={() => void join()} disabled={busy || !code.trim()}>
              {busy ? "Joining…" : "Join"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted text-[13px]">
              First time here? Create a household. If someone invited you to We Saw, use their link
              instead.
            </p>
            <Input
              placeholder="Household name — just for you two"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
            />
            <Input
              placeholder="Your name — how they'll see you"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Friend invite code (if someone invited you)"
              autoCapitalize="characters"
              value={appCode}
              onChange={(event) => setAppCode(event.target.value.toUpperCase())}
            />
            <Button
              className="w-full"
              onClick={() => void create()}
              disabled={busy || !householdName.trim()}
            >
              {busy ? "Creating…" : "Create household"}
            </Button>
          </>
        )}

        {error ? <p className="text-bad text-[13px]">{error}</p> : null}
        <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
