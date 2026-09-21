# AGENTS.md

We Saw — a private, two-person movie and TV diary. Log a movie or TV season, rate it 1–10 each,
keep a queue of what's next, and get taste analytics (genres, actors, directors, compatibility,
predictions). Companion apps in the same style: `../watchdesk`, `../watchlist-cabinet`.

## Quick start

```bash
npm install
npm run dev        # http://127.0.0.1:4183 (works with no env at all: local mode + seed catalog)
```

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Vite dev server + `/api/catalog` mounted as dev middleware        |
| `npm run build`     | `tsc -b` then Vite production build                               |
| `npm run lint`      | ESLint flat config (typescript-eslint, react-hooks, Prettier)     |
| `npm run format`    | Prettier write (`format:check` is what CI enforces)               |
| `npm run typecheck` | `tsc -b`                                                          |
| `npm test`          | Vitest (`src/lib/*.test.ts`)                                      |
| `npm run icons`     | Regenerates PWA PNGs from the geometry in `scripts/make-icon.mjs` |

Run `npm run format && npm run lint && npm run typecheck && npm test && npm run build` before
finishing any change. All five must pass; lint warnings are allowed but errors are not.

## Environment

| Variable                        | Used by                      | Notes                                            |
| ------------------------------- | ---------------------------- | ------------------------------------------------ |
| `TMDB_API_KEY`                  | `server/catalog.js` (server) | Free key, themoviedb.org Settings → API          |
| `OMDB_API_KEY`                  | `server/catalog.js` (server) | Free key, omdbapi.com/apikey.aspx                |
| `VITE_SUPABASE_URL`             | browser                      | Optional; absent ⇒ local-only mode               |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser                      | `VITE_SUPABASE_ANON_KEY` also accepted           |
| `VITE_SITE_URL`                 | browser                      | OAuth redirect base; defaults to `window.origin` |

Never move `TMDB_API_KEY` / `OMDB_API_KEY` client-side. New third-party calls go through
`server/catalog.js` and are exposed as `?action=` endpoints via `api/catalog.js` (Vercel) and the
Vite dev middleware in `vite.config.ts`.

## Architecture

```
api/catalog.js          Thin Vercel function → server/catalog.js
server/catalog.js       TMDB + OMDb logic; actions: health|search|title|ratings|trending|
                        similar|providers|air (same-origin gate, 8s timeouts, edge cache)
vite.config.ts          Mounts the same handler as dev middleware; @/ alias
src/main.tsx            createRoot + ErrorBoundary + StoreProvider
src/App.tsx             Auth/member gates, bottom tab bar (Log, Up Next, History, Stats, Settings)
src/lib/types.ts        All shared types (Title, Watch, Rating, ListItem, Entry, ...)
src/lib/store.tsx       Store provider: local/cloud modes, realtime wiring, write-through actions,
                        derived `entries` (helpers in `src/lib/store/`)
src/lib/store/          helpers.ts (pure state helpers), mappers.ts (cloud rows → types),
                        realtime.ts (incremental change handlers)
src/lib/analytics.ts    Pure stats + taste engine (unit tested, no React, no I/O)
src/lib/dates.ts        Local calendar dates (date-only values, never UTC-shifted)
src/lib/api.ts          Browser client for /api/catalog + poster URL + Title helpers
src/lib/supabase.ts     Client + isSupabaseConfigured (drives local vs cloud mode)
src/lib/seed.ts         Bundled 25-title starter catalog for offline/keyless mode
src/hooks/              useAuth (Supabase Google auth), useViewTransition, useCountUp
src/components/         Poster, Backdrop, ScoreChip (+scoreBand), RatingPicker, WatchCard,
                        LogSheet, DiscoveryRow, DiscoverySheet, WhereToWatch, BarList,
                        ActivityHeatmap, StartChecklist, SignInGate, OnboardingGate, Logo,
                        ErrorBoundary
src/components/ui/      Tailwind/shadcn-style primitives (Button, Input, Select, Textarea, Chip,
                        Drawer via vaul, Skeleton)
src/views/              One file per tab, plus ReviewView (Year in Review) and DemoPreview
supabase/migrations/    Versioned SQL (idempotent): tables, RLS, realtime, invite RPCs
.github/workflows/      ci.yml (checks) and migrate.yml (supabase db push on merge to main)
```

Rules that keep this codebase coherent:

- Views/components never call Supabase directly. All persistence goes through `useStore()`.
- `src/lib/analytics.ts` stays pure and side-effect free. New analytics = new exported function +
  a test in `src/lib/*.test.ts`.
- Date-only values go through `localDateString()` from `src/lib/dates.ts`; `toISOString()` shifts
  the calendar day in non-UTC timezones and is only for timestamps.
- UI is Tailwind v4 utilities + shadcn-style primitives from `src/components/ui` (Button, Input,
  Select, Textarea, Drawer, Skeleton) with `cn()` from `src/lib/utils.ts`. Do not add new
  hand-written class names; design tokens live in `@theme` in `src/styles.css`, with the AMOLED
  variant keyed off `document.documentElement.dataset.theme` (see `src/lib/theme.ts`).
- Sheets/overlays use the vaul `Drawer` primitive (it owns focus trapping and Esc); icon-only
  buttons need `aria-label`; transient messages use `role="status"`.
- Chart-heavy surfaces (Stats, Year in Review) are lazily imported. Keep new heavy dependencies out
  of the app shell; if a view needs one, `React.lazy` it in `src/App.tsx` and give it a Suspense
  skeleton.
- New catalog actions keep the same-origin gate, `cacheControl`, and request timeouts.
- Streaming availability comes from TMDB's `watch/providers` (JustWatch data) and `air` next-episode
  lookups. The JustWatch attribution in `WhereToWatch` and Settings is required by TMDB's terms —
  do not remove it, and attribute any new JustWatch-derived surface the same way.
- Per-device preferences live in localStorage: `wesaw.theme` (see `src/lib/theme.ts`) and
  `wesaw.region` (see `src/lib/region.ts`); both are read on parse, never synced to Supabase.
  Onboarding state uses the same channel: `wesaw.invite` (a pending invite code, captured from
  `?invite=` and cleared after a successful join — see `src/lib/invite.ts`) and
  `wesaw.checklist-dismissed` (the first-run checklist). The sample-household preview builds
  fixture data from `src/lib/demo.ts` and is never persisted.
- Brand mark: two eyes in the couple colours (amber + coral) looking slightly toward each other
  on a rounded charcoal tile. The geometry is duplicated in four places that must stay in sync:
  `public/icon.svg` (favicon), `public/logo.svg` (lockup), `src/components/Logo.tsx` (in-app) and
  `scripts/make-icon.mjs` (PNG rasteriser, `npm run icons`). Change all four together.
- Path alias `@/` → `src/`. No relative imports inside `src/`.
- Prettier runs `prettier-plugin-tailwindcss`, so utility order is automatic — never hand-sort.
- TypeScript is pinned to `~6.0.3` because typescript-eslint does not support TS 7 yet.

## UI copy and file conventions

- **Functional components only** — never class components. Error boundaries use
  `react-error-boundary` (`src/components/AppErrorBoundary.tsx`).
- Keep files small: components and views under ~250 lines, everything under ~750. If a view grows
  past that, split it into section components (see `src/components/stats/*`) and put derived data in
  a hook (`src/hooks/useStatsData.ts`). The store keeps its data layer in `src/lib/store/`
  (`helpers.ts`, `mappers.ts`, `realtime.ts`) so `store.tsx` stays orchestration.
- One component per file, file name = component name. PascalCase for `components/` and `views/`,
  camelCase for `lib/` and `hooks/`.
- Sentence case everywhere: buttons, headings, labels, chips, captions and empty states all start
  with a capital letter ("Save watch", "On joint watches", "Leave-one-out", "Added by Sam").
- Lowercase only for inline fragments that continue a value or sentence ("12% non-English",
  "Sam — 3 solo rated · avg 7.1", "4 finished · 2 dropped").
- Shared helpers live in `src/lib` (e.g. `formatWatchDate` in `src/lib/dates.ts`), UI primitives in
  `src/components/ui` (Button, Input, Select, Textarea, Chip, Drawer, Skeleton). Never export a
  utility from a component file; pure analytics belong in `src/lib/analytics.ts` (with tests)
  rather than new one-off modules.

## Data model (Supabase)

Multi-tenant by **household**. Every user-data table carries `household_id` and its policies use
`my_household_id()`; `is_member()` alone is only for the shared `titles` catalog.

- `households` — the privacy boundary; name editable by its members.
- `members` — `auth.users.id` → `display_name` + `household_id`. Only household members are visible
  to each other.
- `titles` — TMDB metadata cached as JSON, keyed `movie:<id>` / `tv:<id>`, shared across households.
- `watches` — one row per movie or TV season, scoped by `household_id`. `watchers uuid[]` is who
  watched, `picked_by` is who chose it. A joint watch has every member, a solo watch has one.
  Logging reconciles Up Next: movies flip to `done`, a logged season moves the show to `watching`.
- `ratings` — `(watch_id, user_id)` primary key, score 1–10. RLS: you can only rate watches you are
  a watcher of, and only as yourself.
- `list_items` — Up Next entries, unique per `(household_id, title_id)`, status
  `queued | watching | dropped | done`. Logging a movie flips it to `done` instead of deleting the
  row — queue analytics (median wait, abandon rate) depend on that history, so don't "clean up"
  done rows. `done` rows are hidden in the Up Next view and reappear as `queued` if re-added.
- `invite_codes` + `redeem_invite(code, name)` — one-use invite into an existing household.
- `app_invites` + `create_app_invite()` — friend invites that gate `create_household(...)`; the very
  first household is always allowed so a fresh deployment can bootstrap from the app.

Local mode mirrors the same shape in `localStorage` key `wesaw.data.v1` (see `WeSawData` in
`src/lib/types.ts`). Any schema change needs: a new timestamped file in `supabase/migrations/`
(never edit an applied migration), plus the matching load/map code in `src/lib/store.tsx`. New
user-data tables must ship `household_id` and household-scoped policies in the same migration.

The database has never been created, so `20260921000000_initial_schema.sql` is still the only
migration and may be squashed or edited freely. Once it has been applied anywhere, treat it as
append-only — add a new timestamped file for every change.

## Analytics and the taste engine

- Entry scopes: **joint** (`watchers.length > 1`) and **solo per person** (`watchers == [personId]`).
  Stats scope chips let the user choose Together or one person's solo watches; they are deliberately
  never mixed.
- `buildTasteProfile(entries, personId)` → smoothed genre/actor/director/type affinities
  (prior weight 2 toward the person's mean). `predictScore`, `rankPicks` (safe = min predicted),
  `topGenreOverlap` (reason strings), `predictionAccuracy` (leave-one-out, needs 5+ ratings).
- Watch time: movie = runtime; TV = per-episode runtime × episode count of the logged season.
- Year filters use the **watch date** year (`watchedOn.slice(0, 4)`), not release year.
- Habit analytics: `activityHeatmap` (53 weeks, Monday-first), `weekdayCounts`, `watchStreaks`
  (consecutive weeks), and `queueStats` (median added→watched lag, oldest waiting item, abandon
  share). All take an injectable `now` for tests.
- Depth analytics: `pickStats`, `genreGapStats` (duel), `languageStats` (needs
  `title.originalLanguage`), `decadeStats`, `runtimePoints` (movies only), `rewatchStats`,
  `compareMonthly` (joint/solo split per month) and `buildInsights` (plain-language cards).
- Language/country data is optional on `Title` and filled lazily: Stats offers a "Fetch N languages"
  action that re-fetches details and writes back through `patchTitle` (which also updates the cached
  payload in Supabase). Never assume `originalLanguage` exists; `languageStats` reports `unknown`.
- `src/lib/recapImage.ts` renders the Year in Review share image on a canvas (posters loaded with
  `crossOrigin="anonymous"`; names wrapped manually). Keep it dependency-free.

## Performance

- Bundle budgets are enforced: `npm run check:bundle` (after `npm run build`) caps the shell
  (index + react + supabase) at 220 KB gzip, lazily loaded chunks at 130 KB, and CSS at 20 KB.
  CI runs it, plus Lighthouse budgets from `lighthouserc.json`.
- `src/lib/api.ts` keeps in-memory session caches (title details, providers, air dates, similar,
  trending with TTLs). Add new catalog reads there rather than fetching from components.
- Realtime is incremental: rating/watch/list-item events merge straight into state from the event
  payload; only `titles`, `households` and `invite_codes` fall back to a debounced full
  `loadCloud()`. Own writes are skipped via author columns. Window-focus refetch is throttled to
  30 s.
- Recharts is the only heavy UI dependency and must stay behind `React.lazy` (Stats, Review,
  Demo). Animations are capped at 450 ms; radar/scatter are non-animated so they don't replay on
  every render.
- `activityHeatmap`/`predictionAccuracy`/`buildInsights` must stay linear; `predictionAccuracy`
  uses aggregate-subtract leave-one-out (no per-entry profile rebuilds). Keep an eye on the
  `react-hooks/preserve-manual-memoization` lint rule — if it fires on a `useMemo`, the compiler
  can't verify the deps, so compute the value inline instead of forcing the memo.
- The service worker (vite-plugin-pwa) precaches the shell and stale-while-revalidates TMDB
  images; `/api/catalog` is network-first with a 5 s timeout. `manifest: false` because the
  hand-written `public/manifest.webmanifest` stays the source of truth.

## Tooling / CI

- CI (`.github/workflows/ci.yml`): lint → format check → typecheck → test → build → bundle budget
  on Node `lts/*` and `latest`, plus a Lighthouse budget job.
- Migrations (`.github/workflows/migrate.yml`): on merge to `main` touching `supabase/**`, runs
  `supabase link` + `supabase db push`. Requires repo secrets `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`; without them it skips with a notice. Migrations
  are idempotent, so re-applying over an existing database is safe.
- There are 3 accepted `react-refresh/only-export-components` warnings (store + two component
  files). Do not silence them by weakening the rule config.
- Dependency policy: keep npm packages and workflow actions on their latest releases. Two
  deliberate exceptions: TypeScript stays on `6.x` (typescript-eslint's peer range is `<6.1.0`), and
  `@types/node` tracks the newest Node even though CI runs LTS/latest runtimes.

## Current status (September 2026 snapshot — update as you go)

Shipped: per-person profiles (watchers + RLS), invite codes, **multi-household tenancy with
invite-gated household creation**, Up Next with dropped tracking, year filters, Year in Review with
copy-recap text, taste engine (predictions, Tonight's pick, accuracy), ESLint/Prettier/CI/migration
workflows, icon + wordmark (`public/icon.svg`, `public/logo.svg`, kept in sync with
`scripts/make-icon.mjs`), deploy hardening (local-date fix, ErrorBoundary, API timeouts +
same-origin gate + edge cache, TMDB/OMDb attribution, `noindex`, README deploy checklist), and the
UI overhaul (Tailwind v4 + shadcn-style primitives, vaul sheets, View Transitions, count-ups,
skeleton loaders, Recharts donut/radar/bar with lazy chunks, backdrop heroes, confetti Year in
Review, AMOLED theme), discovery (trending + "because you loved X" ranked by the safer of both
predicted scores) and where-to-watch/next-episode air dates, plus the habit dashboard (53-week
heatmap, weekday profile, week streaks, Watch/Hours trend toggle, Queue health with median wait and
abandon rate, per-person rating habit histograms), onboarding (invite links, first-run
checklist, sample-household demo, partner-joined notice, in-context logging hints), insight cards,
genre duel with drill-down, picked-by capture, taste depth (language share, era ratings, runtime
scatter, rewatches), the shareable Year in Review image, and the performance pass (linear
leave-one-out accuracy, memoized Stats derivations, capped chart animations, session API caches,
incremental realtime merges with a throttled focus refetch, household indexes, offline PWA with
TMDB image caching, `content-visibility` history, and bundle + Lighthouse budgets in CI), plus the
component refactor (functional-only React, StatsView split from 1,127 lines into 14 section
components plus `useStatsData`/`useTitleEnrichment`, store split into `store/helpers` +
`store/mappers` + `store/realtime`) and the queue fix (logging a movie now flips its list item to
`done` instead of deleting it, so finished/abandon-rate stats actually count).

Not yet done, in rough priority order:

1. First commit + push to `samiashi/we-saw`, and set the three migration secrets (repo was only
   `git init`-ed; nothing committed yet).
2. Import history from Trakt / Letterboxd / TV Time so stats start full.
3. Push nudges ("rate last night's movie", new episodes) on top of the service worker.
4. Backups: scheduled `supabase db dump` workflow + restore docs (free tier has no PITR; projects
   pause after a week of inactivity).
5. Retry/backoff for failed sync writes; integrity constraints on `watchers`.
6. Episode-level ratings — deferred by design; seasons were the chosen granularity.

## Verification habits for agents

- Unit tests first for `analytics.ts` changes; keep them fast and deterministic (no dates from
  `Date.now()` without injecting `now`).
- UI changes: `npm run dev` and click through with no env vars (local mode + seed catalog). The seed
  catalog makes every feature usable without API keys.
- Cloud changes: typecheck plus reasoning about RLS — policies live in the migrations; every new
  user-data table needs `household_id` and household-scoped select/insert/update/delete policies
  (`my_household_id()`), and (if realtime matters) a line in the `supabase_realtime` publication
  block plus a `household_id=eq.` channel filter in the store.
