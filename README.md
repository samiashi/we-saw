<div align="center">

# We Saw

A shared movie and TV diary for couples and small groups: log what you watched, rate it out of 10 each, and see your habits turn into stats.

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&labelColor=111317)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&labelColor=111317)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&labelColor=111317)
![Supabase](https://img.shields.io/badge/Supabase-ready-3ecf8e?style=flat-square&labelColor=111317)
![PWA](https://img.shields.io/badge/Installable-PWA-e8b64c?style=flat-square&labelColor=111317)

</div>

## Features

- Search movies and shows (TMDB), log a movie or a single TV season with the date (or "Not sure") and a note.
- **Multi-household**: every group gets its own private data; friends start their own household with a friend-invite code you generate.
- **Up Next** tab: queue titles, mark what's watching, and drop what you bailed on — logging a movie removes it, logging a season moves it to Watching.
- **Tonight's pick**: a taste engine builds a genre/actor/director profile per person and ranks your list by the safer minimum score, with a reason line.
- **Discover**: Popular this week and "Because you loved X" rows, with a _Safe for us_ toggle that ranks by the lower of your two predicted scores.
- **Where to watch**: streaming, free, rent and buy providers for your country (JustWatch via TMDB) in discover and history sheets, plus **next-episode air dates** on TV shows in Up Next.
- Choose who watched: **Together** or **Just me** — rating slots, waiting states and stats all follow the watchers.
- Rate each watch 1–10 — one score from each of you; nobody can overwrite their partner's score.
- Critic scores cached per title: IMDb, Rotten Tomatoes and Metacritic (via OMDb) to compare against your own.
- Stats scoped three ways (**Together**, and per person solo) with **year and movie/TV filters**, taste match, rating spread, prediction accuracy, you-vs-critics deltas, activity chart and decade breakdown.
- **Habit dashboard**: 53-week activity heatmap, weekday profile, week streaks, Watch/Hours/Compare trend, per-person rating habits, and Queue health (median wait, oldest backlog item, abandon rate).
- **Insight cards** — auto-written lines like "Sam's picks rate 0.8 higher on average" or "Drama splits you most", plus a **genre duel** (diverging bars), **taste depth** (non-English share, ratings by era, runtime-vs-rating scatter, comfort rewatches) and a tappable genre drill-down.
- **Who picked it** is captured with one tap, and the **Year in Review** exports a shareable 1080×1350 image (share sheet on mobile, download elsewhere).
- **Year in Review**: a per-year recap page (top 5, genres, faces, taste match, solo vs together) with one-tap "copy recap" text to paste into chat.
- Invite your partner with a one-use code or an **invite link** (`?invite=CODE`) — she signs in with Google and joins in one tap.
- **First-run checklist** (log a watch, invite your partner, pick your region), a **sample-household preview** on the sign-in screen, and in-context hints the first few times you log.
- Works offline: the service worker precaches the app shell, caches TMDB images, and serves cached catalog data when the network is slow or gone.
- Two modes: local-only (this device, localStorage) or synced between phones (Supabase + Google login, realtime refresh).
- Installable PWA, dark-only, mobile-first, with a Charcoal or AMOLED theme.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 + shadcn-style primitives (Radix Slot, vaul drawer, lucide icons)
- Recharts and the Year in Review are lazily loaded; the app shell stays small
- Supabase Auth and Postgres (optional but recommended)
- Vercel, with a serverless `/api/catalog` function that keeps API keys server-side

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4183/`.

Without env vars the app runs local-only against the starter catalog. To enable real search and critic scores, create `.env.local`:

```bash
cp .env.example .env.local
```

and set:

```bash
TMDB_API_KEY=          # themoviedb.org → Settings → API (free)
OMDB_API_KEY=          # omdbapi.com/apikey.aspx (free, 1k/day)
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SITE_URL=
```

`npm run icons` regenerates the PWA icons from the same geometry as `public/icon.svg`, and `public/logo.svg` is the wordmark lockup (dependency-free PNG writer, no image deps). The mark is two eyes in the couple colours — amber and coral looking at each other.

## Checks & automation

```bash
npm run lint          # ESLint (flat config: typescript-eslint + react-hooks, Prettier-compatible)
npm run format        # Prettier write
npm run format:check  # Prettier check (used by CI)
npm run typecheck     # tsc
npm test              # Vitest
```

`.github/workflows/ci.yml` runs lint, format check, typecheck, tests and build on every push and PR, across the active LTS and latest Node lines.

`.github/workflows/migrate.yml` applies `supabase/migrations` to the linked project whenever a PR lands on `main` (or manually via workflow dispatch). Add three repository secrets to enable it:

- `SUPABASE_ACCESS_TOKEN` — supabase.com/dashboard/account/tokens
- `SUPABASE_DB_PASSWORD` — the project's database password
- `SUPABASE_PROJECT_REF` — the project ref from the dashboard URL

Migrations are idempotent, so applying them over a database that already has some of the schema is safe, and without the secrets the workflow skips with a notice instead of failing. Prefer Supabase's own GitHub integration? Connect the repo under Project Settings → Integrations → GitHub and it applies migrations (and opens preview branches on PRs) without any workflow.

## Supabase (sync between both phones)

1. Create a Supabase project and apply the migrations (either run `supabase/migrations/*.sql` in the SQL editor, `supabase db push` locally, or push to `main` and let the Migrate workflow do it).
2. Enable Google as the only Auth provider and allow-list your deployed URL plus local dev in Auth URL settings.
3. Sign in from one phone and choose **Start a household** — you become its first member. No SQL needed.
4. Invite your partner from **Settings → Invite your partner**: generate a one-use code, she signs in with Google and redeems it on the join screen.

Once a household exists, creating another one requires a **friend invite** generated in **Settings → Invite a friend**, so the deployment stays invite-only without any per-user API keys. `create_household`, `create_app_invite` and `redeem_invite` are security-definer RPCs, so no service key ever reaches the app.

Row-level security scopes everything to a household: members, watches, ratings, list items and household invites are only visible to their own household (`my_household_id()`); ratings can only be written by their owner and only for a watch they are in (`watchers`); a trigger keeps `watchers` limited to household members; `titles` stays a shared metadata catalog. Watches and list changes stream over Supabase Realtime with household filters.

## Backups

`.github/workflows/backup.yml` runs every Sunday at 03:00 UTC (or manually via workflow dispatch). It links the project, dumps the `public` schema and its data as two files, and uploads them as a workflow artifact kept for 30 days. It uses the same three repository secrets as the Migrate workflow and skips with a notice when they are missing.

To restore:

1. Download the artifact from the workflow run (Actions → Backup → the run → Artifacts).
2. Apply `schema.sql` — for example `psql "$DATABASE_URL" -f schema.sql` against a fresh project, or paste it in the Supabase SQL editor.
3. Apply `data.sql` the same way. The dump covers `public` only; `auth.users` is managed by Supabase, so restore into a project where the same Google accounts exist (or the same project).

The free tier has no point-in-time recovery and projects pause after a week without traffic, so keep a copy of the artifact elsewhere if the data matters.

## Deploy checklist

1. Push the repo to GitHub, import it in Vercel, and set these env vars for Production and Preview: `TMDB_API_KEY`, `OMDB_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`.
2. Supabase → Authentication → URL configuration: allow-list the deployed origin plus `http://127.0.0.1:4183`, and enable Google as the only provider.
3. Google OAuth: keeping the consent screen in Testing with both accounts added as test users avoids verification; publish it if you'd rather not manage test users.
4. Turn off Vercel deployment protection for the production domain, or your partner can't open the app.
5. Add the three migration secrets (see Checks & automation) and protect `main` with the CI check.
6. `vercel.json` already ships SPA rewrites, security headers, a Supabase-friendly CSP, and the app is `noindex`. A custom domain is optional.

## Deploy

Deploy to Vercel and add the env vars above in the project settings. `server/catalog.js` calls TMDB and OMDb with an 8s timeout, rejects cross-origin data requests, and marks deterministic responses `s-maxage=3600, stale-while-revalidate=86400` so the edge absorbs repeat lookups.

## Architecture

```
api/catalog.js        Vercel function: ?action=health|search|title|ratings
server/catalog.js     TMDB + OMDb logic (also mounted into the Vite dev server)
src/lib/store.tsx     Store provider: local/cloud modes, realtime wiring, write-through actions
src/lib/store/        Pure helpers, cloud row mappers and realtime change handlers
src/lib/analytics.ts  Pure stat math and the taste engine (unit tested)
src/lib/seed.ts       Offline starter catalog
src/lib/theme.ts      Charcoal / AMOLED theme persistence
src/components/stats/ One small component per analytics section (donut, duel, heatmap, …)
src/components/ui/    Button, Input, Select, Textarea, Chip, Drawer (vaul), Skeleton, Toast
src/views/            Log, Up Next, History, Stats, Year in Review, Demo, Settings
tests/                Vitest suites (analytics, dates, store helpers, retry, components)
supabase/migrations   Versioned SQL: tables, RLS, realtime, invite RPCs
supabase/config.toml  Supabase CLI project config
```

## Data model

- `households` — the privacy boundary. One per couple/group; everything below hangs off it.
- `members` — allowlist keyed by `auth.users.id` with `display_name` and `household_id`.
- `titles` — TMDB metadata cached as JSON, keyed `movie:<id>` / `tv:<id>`, shared across households.
- `watches` — one row per movie or season. `household_id` scopes it, `watchers uuid[]` is who watched, `picked_by` is who chose it; a joint watch has every member, a solo watch has one. Logging reconciles Up Next: movies flip to `done`, a logged season moves the show to `watching`.
- `ratings` — `(watch_id, user_id)` primary key, score 1–10. RLS: you can only rate watches you are a watcher of, and only as yourself.
- `list_items` — Up Next entries, unique per `(household_id, title_id)`, `status` in `queued | watching | dropped`.
- `invite_codes` + `redeem_invite(code, name)` — one-use invite into a household.
- `app_invites` + `create_app_invite()` — friend invites that gate creating a new household.

Combined score, gaps and every stat are derived client-side from those tables. Joint watches (`watchers` covers everyone) feed the Together scope and taste match; solo watches feed only that person's scope. The taste engine (`src/lib/analytics.ts`) builds smoothed genre/actor/director/type affinities per person, predicts scores for candidates, and self-checks with leave-one-out accuracy.

## Data attribution

Metadata and images from TMDB ("this product uses the TMDB API but is not endorsed or certified by
TMDB"), critic scores from OMDb (IMDb, Rotten Tomatoes and Metacritic data, CC BY-NC 4.0), and
streaming availability from JustWatch via TMDB. All three attributions are shown in the app and
must stay that way.

## Roadmap

- Import existing history from Trakt, Letterboxd or TV Time so stats start full.
- Push nudges ("rate last night's movie", new episodes, watchlist arrivals).
- Backups: scheduled `supabase db dump` + restore docs.
- TMDB language/country enrichment for "foreign share" analytics.
- Episode-level ratings if season-level ever feels too coarse.
