# Find something new

Research and implementation decisions, 17 November 2026.

## Product research

- [Netflix AI Discover](https://about.netflix.com/en/news/introducing-ai-discover), announced 3 November 2026 as a limited rollout, starts with themes (mood, group, or available time), supports refinement and skipping recommendations, and explains results. We adopt optional mood shortcuts and session-only “Not tonight” controls. We do not claim to reproduce Netflix's undisclosed ranking architecture.
- [Spotify Prompted Playlists](https://support.spotify.com/us/article/prompted-playlists/) combines a request with listening preferences, includes explanatory notes, and lets listeners refine/edit prompts. We adopt optional free text plus brief explanations and an explicit generate action.
- [Letterboxd recommendations](https://support.letterboxd.com/hc/en-us/articles/15178828078223-Can-Letterboxd-generate-recommendations-for-me) use sorting/filtering, watched/liked history, and similar-film themes/nanogenres. We retain catalog-backed cards and deterministic filters rather than generating an unverified list of film names.

These are documented product patterns, not evidence of recommendation-quality gains in We Saw.

## Experience

Log → Find something new opens a vaul drawer. Optional mood, movie/TV, time and free text controls lead to up to three unseen movie/show picks. No Up Next entries are required. View title opens the existing catalog details, streaming providers (with existing JustWatch attribution), and log action. A TV time limit applies to one episode. Unknown runtimes are excluded under a time limit. Skips apply only until the picker closes. No background requests or persisted preference inference.

The server paginates every logged household watch, including movies, TV season runs, rewatches, and watches without dates. All valid ratings contribute to separate per-viewer summaries of genres, actors, directors/TV creators, media type, language, country, decade and runtime. Counts and average ratings preserve likes and dislikes; missing ratings are not inferred as likes. Metadata is limited to what the app stores (including up to ten cast members per title); missing metadata remains unknown. Diary notes are omitted.

The entire history is processed on each explicit request; it is not sent verbatim to the model. The prompt contains bounded strongest/weakest facet summaries, candidate-specific aggregates from the complete facet maps, and up to 64 representative rated watches with per-person scores and together/solo scope. This is full-history inference, not model training. A failed history page fails the request rather than silently using a partial history.

Discovery combines [TMDB recommendations](https://developer.themoviedb.org/reference/movie-recommendations) from up to six well-rated history titles, credits for up to two preferred actors and two directors/creators, and genre-filtered [movie](https://developer.themoviedb.org/reference/discover-movie)/[TV](https://developer.themoviedb.org/reference/discover-tv) discovery. Seeds rotate across viewers and media types. Ambiguous person-name matches are skipped. Candidate sources are interleaved before enriching up to 24 unseen titles with catalog details (six concurrent detail requests). Already logged titles, including unrated ones, and session skips are excluded. All filters are enforced server-side; the model chooses only from eligible candidates. This is a bounded catalog search, not an exhaustive scan of TMDB. Up Next is not read. An empty diary prompts the user to log/rate watches first.

## Architecture and quality

- Authenticated POST `/api/catalog?action=tonight`; same-origin gate retained. The server verifies the session with Supabase Auth, derives household membership, and reads household-filtered data under the caller's JWT/RLS. Client-supplied candidate data, household IDs, model IDs and histories are not accepted.
- `OPENAI_API_KEY` remains server-only. Fixed `gpt-6.1-sol`, `reasoning.effort: low`, Responses API, `store: false`, bounded output, no tools or automatic retries.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) restrict title IDs to the shortlist. Runtime validation also rejects duplicate/invented IDs, invalid evidence, refusal, incomplete output and malformed responses. Text remains a fallible interpretation; numerical scores and stats stay in the existing engine.
- [OpenAI safety guidance](https://developers.openai.com/api/docs/guides/safety-best-practices) informs bounded inputs/outputs, data/instruction separation, and limiting the model to supplied evidence. No model-driven writes. Render all explanations as React text, not HTML/Markdown.
- Failed requests show a retryable error; no queue-only fallback. Empty results remain empty. Existing deterministic Up Next ranking is separate and unchanged.
- Requests are cancelable; changed history/controls invalidate stale responses. No request runs on mount. No private results in localStorage, shared CDN cache or service-worker cache.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): loading, errors, and completion use a polite status region; drawer title/description, labeled inputs, pressed-state mood buttons, and keyboard focus handling use existing primitives. This is not a claim of full WCAG conformance.
- Household usage is limited atomically in Postgres to 20 attempts per UTC day, at least eight seconds apart. Discovery attempts (including empty candidate pools or later failures) consume an attempt to bound catalog traffic and retry spending. Empty diaries do not consume quota. Only the quota RPC can mutate counters. If it is unavailable, AI fails closed.
- The usage table is server bookkeeping: it has no browser store collection, map/load path, or realtime subscription. No diary schema changes.

## Configuration and rollout

1. Set `OPENAI_API_KEY` locally and in Vercel Production/Preview as needed. Never use a `VITE_` prefix. Existing Supabase URL/publishable-key variables remain required server-side too.
2. Apply `supabase/migrations/20261117112443_tonight_usage.sql` using the repo migration workflow or `supabase db push --remote --yes` against the intended linked project (CLI v3 defaults to local). Applied to the linked We Saw production project on 17 November 2026; migration history and quota-table/RPC permissions were verified afterward. The API requires the quota function; it will not spend without it.
3. Deploy/redeploy the app. The full-history update requires no additional migration or environment variable. No OpenAI SDK or new browser dependency is needed.
4. Verify an authenticated household can generate a pick and that an unauthenticated POST returns 401. Check title details and logging from a result.

Requests send anonymous viewer labels, catalog metadata and scores, plus the text the user explicitly enters. Account IDs, names, diary notes and watch dates are not sent. Free text can contain personal data if the user enters it. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data): API data is not used for training by default; `store: false` does not eliminate abuse-monitoring retention. Key rotation is recommended for any credential pasted into chat.

## Validation and evaluation

Run the required format/lint/typecheck/test/build commands and bundle check. API tests mock external network boundaries while exercising auth/tenancy, full-history pagination (including a smaller server page cap), catalog discovery without any queue reads, runtime/exclusion filters, privacy and structured output validation. Component tests cover requests with no queue, errors without a misleading fallback, preference changes, skips and cancellation. `tests/tonight-usage.sql` is for a disposable local Postgres database only; it validates the unchanged quota and RLS in a rolled-back transaction.

Full-history update verification: 92 unit/component tests, formatting, lint (three existing warnings), typecheck, production build and bundle budgets passed. A live request using synthetic movie/TV history and real TMDB/OpenAI APIs returned three unseen titles with actor/director evidence in 8.4 seconds. A 390px mobile fixture verified results, skipping and reset; it and its test server were removed afterward. Full authenticated household UI testing remains pending.

The original quota migration was applied and verified on 17 November 2026. Recommendation accuracy still needs evaluation on actual household use; automated and synthetic checks validate the mechanics, not personal enjoyment.

Before claiming better recommendations, compare the existing ranking and AI on representative prompts and unseen ratings: constraint violations, unsupported explanation claims, both-viewer suitability, pick acceptance, subsequent scores, latency and tokens. Keep failures and sparse-history cases in the evaluation set. See [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Live synthetic checks validate the API contract, not personal recommendation accuracy.
