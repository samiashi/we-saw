import { LogoLockup } from "@/components/Logo";

export function SetupGate() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="border-line bg-surface flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[20px] border p-7 text-center">
        <LogoLockup />
        <h1 className="text-xl font-bold">Connect your Supabase project</h1>
        <p className="text-muted text-sm">
          We Saw needs a database to store your log. Add these to your environment and redeploy:
        </p>
        <code className="bg-bg border-line block w-full overflow-x-auto rounded-xl border p-3 text-left font-mono text-xs whitespace-pre-wrap text-[#cbd0dc]">
          VITE_SUPABASE_URL=…{"\n"}VITE_SUPABASE_PUBLISHABLE_KEY=…
        </code>
        <p className="text-muted text-[13px]">
          Apply the SQL under <code className="font-mono">supabase/migrations</code>, then sign in
          with Google.
        </p>
      </div>
    </div>
  );
}
