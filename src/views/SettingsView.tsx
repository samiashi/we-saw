import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { catalogHealth, type CatalogHealth } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { localDateString } from "@/lib/dates";
import { getRegion, REGIONS, setRegion } from "@/lib/region";
import { useStore } from "@/lib/store";
import { getTheme, setTheme, type ThemeName } from "@/lib/theme";
import { cn } from "@/lib/utils";

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatusRow({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <div className="border-line bg-surface flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm">
      <span className={cn("size-2.5 shrink-0 rounded-full", on ? "bg-good" : "bg-bad")} />
      <span className="flex-1">{label}</span>
      <span className="text-muted text-[13px]">{detail}</span>
    </div>
  );
}

export function SettingsView() {
  const {
    mode,
    people,
    userId,
    nameFor,
    renamePerson,
    household,
    renameHousehold,
    invites,
    createInvite,
    revokeInvite,
    appInvites,
    createAppInvite,
    revokeAppInvite,
    refresh,
    exportData,
    importData,
    clearAll,
    auth,
    syncError,
  } = useStore();
  const [health, setHealth] = useState<CatalogHealth | null | "loading">("loading");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [householdDraft, setHouseholdDraft] = useState<string | null>(null);
  const toast = useToast();
  const [theme, setThemeState] = useState<ThemeName>(() => getTheme());
  const [region, setRegionState] = useState(getRegion);
  const activeInvite = invites.find((invite) => !invite.consumedAt) ?? null;
  const activeAppInvite = appInvites.find((invite) => !invite.consumedAt) ?? null;

  useEffect(() => {
    void catalogHealth().then(setHealth);
  }, []);

  function chooseTheme(next: ThemeName) {
    setThemeState(next);
    setTheme(next);
  }

  function chooseRegion(code: string) {
    setRegionState(code);
    setRegion(code);
  }

  const regionOptions = REGIONS.some((option) => option.code === region)
    ? REGIONS
    : [{ code: region, name: region }, ...REGIONS];

  function draftFor(personId: string, fallback: string) {
    return nameDrafts[personId] ?? fallback;
  }

  async function commitName(personId: string, fallback: string) {
    const draft = draftFor(personId, fallback);
    setNameDrafts((current) => ({ ...current, [personId]: draft }));
    if (draft.trim() && draft !== fallback) await renamePerson(personId, draft);
  }

  async function copyCode(code: string) {
    const copied = await copyText(code);
    toast.show(copied ? "Invite code copied." : "Copy failed — select the code manually.");
  }

  async function copyInviteLink(code: string) {
    const copied = await copyText(`${window.location.origin}/?invite=${code}`);
    toast.show(copied ? "Invite link copied." : "Copy failed — share the code manually.");
  }

  async function handleCreateInvite() {
    const code = await createInvite();
    if (code) toast.show("Invite code ready.");
  }

  async function handleCreateAppInvite() {
    const code = await createAppInvite();
    if (code) toast.show("Friend invite ready.");
  }

  async function handleRevokeInvite(code: string) {
    const revoked = await revokeInvite(code);
    if (revoked) toast.show("Invite revoked.");
  }

  async function handleRevokeAppInvite(code: string) {
    const revoked = await revokeAppInvite(code);
    if (revoked) toast.show("Friend invite revoked.");
  }

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `we-saw-${localDateString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.show("Exported your log.");
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const ok = importData(text);
    toast.show(ok ? "Imported your log." : "That file could not be imported.");
  }

  function handleClear() {
    if (!window.confirm("Delete every logged watch on this device?")) return;
    clearAll();
    toast.show("Cleared your log.");
  }

  const missingKeys = health !== "loading" && health !== null && (!health.tmdb || !health.omdb);

  return (
    <div className="flex flex-col gap-[18px]">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight">Settings</h1>
      </header>

      <Section title="Who's watching">
        {people.map((person) => {
          const editable = mode === "local" || person.id === userId;
          return (
            <div key={person.id} className="flex flex-col gap-2">
              <label className="text-muted text-[13px]">
                {editable ? "Name" : `${nameFor(person.id)} (partner)`}
              </label>
              <Input
                value={draftFor(person.id, person.name)}
                disabled={!editable}
                onChange={(event) =>
                  setNameDrafts((current) => ({ ...current, [person.id]: event.target.value }))
                }
                onBlur={() => void commitName(person.id, person.name)}
              />
            </div>
          );
        })}
      </Section>

      {mode === "cloud" && household ? (
        <Section title="Household">
          <div className="flex flex-col gap-2">
            <label className="text-muted text-[13px]" htmlFor="household-name">
              Household name
            </label>
            <Input
              id="household-name"
              value={householdDraft ?? household.name}
              onChange={(event) => setHouseholdDraft(event.target.value)}
              onBlur={() => {
                if (householdDraft != null && householdDraft !== household.name) {
                  void renameHousehold(householdDraft);
                }
                setHouseholdDraft(null);
              }}
            />
          </div>
        </Section>
      ) : null}

      {mode === "cloud" ? (
        <Section title="Invite your partner">
          {activeInvite ? (
            <>
              <p className="text-muted text-[13px]">
                Share the link or the code — she signs in with Google and joins automatically. One
                use only.
              </p>
              <code className="bg-bg border-line text-accent block w-full rounded-xl border p-3 text-center font-mono text-2xl font-bold tracking-[0.28em]">
                {activeInvite.code}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void copyInviteLink(activeInvite.code)}>
                  Copy invite link
                </Button>
                <Button variant="ghost" onClick={() => void copyCode(activeInvite.code)}>
                  Copy code
                </Button>
                <Button variant="danger" onClick={() => void handleRevokeInvite(activeInvite.code)}>
                  Revoke
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted text-[13px]">
                No active invite. Generate a one-use code for your partner.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleCreateInvite()}>Generate invite code</Button>
              </div>
            </>
          )}
        </Section>
      ) : null}

      {mode === "cloud" ? (
        <Section title="Invite a friend">
          <p className="text-muted text-[13px]">
            Give a friend this code so they can start their own household. Households never see each
            other's watches or ratings.
          </p>
          {activeAppInvite ? (
            <>
              <code className="bg-bg border-line text-accent block w-full rounded-xl border p-3 text-center font-mono text-2xl font-bold tracking-[0.28em]">
                {activeAppInvite.code}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void copyCode(activeAppInvite.code)}>
                  Copy code
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleRevokeAppInvite(activeAppInvite.code)}
                >
                  Revoke
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleCreateAppInvite()}>Generate friend invite</Button>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Ratings & metadata">
        <StatusRow
          on={health !== "loading" && Boolean(health?.tmdb)}
          label="TMDB — search, posters, cast & crew"
          detail={health === "loading" ? "checking…" : health?.tmdb ? "configured" : "missing"}
        />
        <StatusRow
          on={health !== "loading" && Boolean(health?.omdb)}
          label="OMDb — IMDb & Rotten Tomatoes scores"
          detail={health === "loading" ? "checking…" : health?.omdb ? "configured" : "missing"}
        />
        {missingKeys ? (
          <div className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3.5">
            <p className="text-muted text-[13px]">
              Add free keys to <code className="font-mono">.env.local</code> (or the Vercel project
              env) and restart:
            </p>
            <code className="bg-bg border-line block w-full overflow-x-auto rounded-xl border p-3 font-mono text-xs whitespace-pre-wrap text-[#cbd0dc]">
              TMDB_API_KEY=…{"\n"}OMDB_API_KEY=…
            </code>
            <p className="text-muted text-[13px]">
              TMDB key: themoviedb.org → Settings → API. OMDb key: omdbapi.com/apikey.aspx. Until
              then the app uses the bundled starter catalog.
            </p>
          </div>
        ) : null}
      </Section>

      <Section title="Sync">
        {mode === "cloud" ? (
          <>
            <StatusRow on label={auth.session?.user.email ?? "Signed in"} detail="cloud mode" />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => void refresh()}>
                Sync now
              </Button>
              <Button variant="ghost" onClick={() => void auth.signOut()}>
                Sign out
              </Button>
            </div>
            {syncError ? <p className="text-bad text-[13px]">{syncError}</p> : null}
          </>
        ) : (
          <p className="text-muted text-[13px]">
            This log lives on this device only. To share it between both phones: create a Supabase
            project, apply the SQL under <code className="font-mono">supabase/migrations</code>, add{" "}
            <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
            <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> to the environment, and
            deploy to Vercel.
          </p>
        )}
      </Section>

      <Section title="Appearance">
        <div className="border-line bg-surface flex gap-1.5 rounded-xl border p-1">
          {(
            [
              ["default", "Charcoal"],
              ["amoled", "AMOLED black"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "text-muted flex-1 rounded-[9px] px-2.5 py-2 text-[13px] font-semibold transition-colors",
                theme === value && "bg-surface-2 text-ink ring-accent/45 ring-1",
              )}
              onClick={() => chooseTheme(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Where you watch">
        <Select
          value={region}
          onChange={(event) => chooseRegion(event.target.value)}
          aria-label="Country"
        >
          {regionOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </Select>
        <p className="text-muted text-[13px]">
          Used to show streaming providers for your country. Availability data by JustWatch.
        </p>
      </Section>

      <Section title="Data">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={download}>
            Export JSON
          </Button>
          {mode === "local" ? (
            <>
              <Button variant="ghost" asChild>
                <label className="relative cursor-pointer overflow-hidden">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => void handleImport(event.target.files?.[0])}
                  />
                </label>
              </Button>
              <Button variant="danger" onClick={handleClear}>
                Clear all
              </Button>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="About">
        <p className="text-muted text-[13px]">
          We Saw keeps a shared diary of everything you two watch, with a 1–10 rating each, and
          turns it into genre, actor, director and taste-match analytics.
        </p>
        <p className="text-muted text-[13px]">
          Metadata and images from{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB. Critic scores
          via the{" "}
          <a href="https://www.omdbapi.com" target="_blank" rel="noreferrer">
            OMDb API
          </a>{" "}
          (IMDb, Rotten Tomatoes and Metacritic data, CC BY-NC 4.0). Streaming availability data
          from{" "}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
