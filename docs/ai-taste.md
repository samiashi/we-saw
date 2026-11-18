# Analyze my taste

Stats → select Together or a person's solo watches, year, and movie/TV → Analyze my taste.
The report contains up to three short insights, measured per-person averages and counts, and
expandable supporting watches with each viewer's actual ratings. Sparse histories show an
empty state rather than invented patterns. Changing filters, household, watches, ratings, or
cached title details clears the displayed report and cancels pending work.

## History and evidence

Authenticated POST `/api/catalog?action=taste` verifies the Supabase session, derives the
household from membership, and reads **every page** of household history under the caller's
JWT/RLS. It never reads Up Next, trusts browser-supplied histories, or substitutes a recent slice.
A failed later page fails the whole analysis. Keyset pagination continues until an empty page,
even when the server's row cap returns fewer than the requested 200 rows.

Filters match Stats: Together means watches with multiple watchers; a person means only their
solo watches. Year uses `watched_on`, not release year; unknown dates count in All time and are
excluded from a specific year. Movie/TV filters use the cached title type. The endpoint rejects
person IDs outside the authenticated household.

`server/tasteContext.js` reuses the full-history taste aggregation in `server/tonightContext.js`.
Every valid matching rating, including low scores, contributes to the per-viewer means and facet
aggregates. Unrated watches count toward the matching history but are never treated as dislikes.
Missing title metadata is reported. Repeated watches count as logged watches, not unique titles.
The model gets bounded selections of high/low facet aggregates and supporting examples; it does
not receive every raw watch. At least two rated watches support each candidate facet. These are
observed patterns, not predictions, causal conclusions, or statistical confidence estimates.

## Model and access

- GPT-6.2 Sol, medium reasoning, Responses API, strict structured output, `store: false`.
- The first developer message holds the reusable task and writing rules. The user message contains the filters and anonymous metric evidence. [OpenAI’s GPT-6.2 migration guide](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart).
- The model chooses supplied metric IDs and writes short explanations. The server rejects
  unknown IDs, duplicate references, malformed/refused/incomplete results, and duplicate cards.
  Exact averages, counts, viewer identities, and supporting watches come from server data.
  Model prose is still an interpretation; schema validation does not prove factual correctness.
- Anonymous viewer labels, aggregate scores and title examples go to OpenAI. No account IDs,
  display names, diary notes, exact watch dates, or household IDs enter the prompt.
- No external knowledge, tools, automatic retries, or model-driven writes. The app renders plain
  React text. Stats and charts work independently if OpenAI is unavailable.
- The existing `consume_tonight_request()` quota is shared by AI discovery and taste analysis:
  20 attempts per household per UTC day, at least eight seconds apart. Failed model attempts
  consume quota; empty/sparse histories and cache hits do not. Missing quota storage fails closed.
- Private responses use `private, no-store`; both GET and POST are excluded from service-worker
  caching. No reports are saved in browser storage or the database.
- A bounded process-memory cache holds at most 30 reports for 15 minutes. Keys include the
  Supabase project, household, filters, viewer list, and complete matching history/title payloads.
  Every lookup follows fresh authentication and a full history read. Cache reuse is best-effort
  across serverless instances and cold starts. Reports in an open tab remain until data changes,
  filters change, or the tab closes; Refresh analysis revalidates on the server.

## Setup and verification

Uses the existing server-only `OPENAI_API_KEY`, Supabase URL/publishable key, and previously
applied `tonight_usage` migration. No new environment variable or migration is required.

Tests cover more than 400 aggregated watches, short-page pagination, missing data, low ratings,
filter parity, auth/tenancy, private responses, quota rejection, invalid model references, cache
isolation/invalidation, cancellation, evidence rendering, and stale-result prevention. Run the
normal format, lint, typecheck, test, build, format-check and bundle checks before release.
