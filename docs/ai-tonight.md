# Pick for tonight

Research and implementation decisions, 17 November 2026.

## Product research

- [Netflix AI Discover](https://about.netflix.com/en/news/introducing-ai-discover), announced 3 November 2026 as a limited rollout, starts with themes (mood, group, or available time), supports refinement and skipping recommendations, and explains results. We adopt optional mood shortcuts and session-only “Not tonight” controls. We do not claim to reproduce Netflix's undisclosed ranking architecture.
- [Spotify Prompted Playlists](https://support.spotify.com/us/article/prompted-playlists/) combines a request with listening preferences, includes explanatory notes, and lets listeners refine/edit prompts. We adopt optional free text plus brief explanations and an explicit generate action.
- [Letterboxd recommendations](https://support.letterboxd.com/hc/en-us/articles/15178828078223-Can-Letterboxd-generate-recommendations-for-me) use sorting/filtering, watched/liked history, and similar-film themes/nanogenres. We retain catalog-backed cards and deterministic filters rather than generating an unverified list of film names.

These are documented product patterns, not evidence of recommendation-quality gains in We Saw.

## Experience

Up Next → Help us choose opens a vaul drawer. Optional mood, movie/TV, time and free text controls lead to up to three picks. View title opens the existing catalog details, streaming providers (with existing JustWatch attribution), and log action. A TV time limit applies to one episode. Unknown runtimes are excluded under a time limit. Skips apply only until the picker closes. No background requests or persisted preference inference.

The first release uses the household queue, excluding dropped/done items. The model considers up to 40 eligible titles from the 1,000 newest queue records and up to 60 rated watches from the 100 most recently logged watches. The result labels how many candidates were considered. This is bounded recent context, not a full-history trained model. Diary notes are deliberately omitted because they are shared and lack per-reviewer attribution.

## Architecture and quality

- Authenticated POST `/api/catalog?action=tonight`; same-origin gate retained. The server verifies the session with Supabase Auth, derives household membership, and reads household-filtered data under the caller's JWT/RLS. Client-supplied candidate data, household IDs, model IDs and histories are not accepted.
- `OPENAI_API_KEY` remains server-only. Fixed `gpt-6.1-sol`, `reasoning.effort: low`, Responses API, `store: false`, bounded output, no tools or automatic retries.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) restrict title IDs to the shortlist. Runtime validation also rejects duplicate/invented IDs, invalid evidence, refusal, incomplete output and malformed responses. Text remains a fallible interpretation; numerical scores and stats stay in the existing engine.
- [OpenAI safety guidance](https://developers.openai.com/api/docs/guides/safety-best-practices) informs bounded inputs/outputs, data/instruction separation, and limiting the model to supplied evidence. No model-driven writes. Render all explanations as React text, not HTML/Markdown.
- Failed requests fall back to the current taste engine with the same explicit type/time/exclusion filters. The UI explicitly says mood preferences were not applied. Empty AI results are not replaced with misleading mood matches.
- Requests are cancelable; changed queue/history/controls invalidate stale responses. No request runs on mount. No private results in localStorage, shared CDN cache or service-worker cache.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): loading, errors, and completion use a polite status region; drawer title/description, labeled inputs, pressed-state mood buttons, and keyboard focus handling use existing primitives. This is not a claim of full WCAG conformance.
- Household usage is limited atomically in Postgres to 20 attempts per UTC day, at least eight seconds apart. Failed model calls consume an attempt to bound retry spending. Only the quota RPC can mutate counters. If it is unavailable, AI fails closed and the local fallback remains usable.
- The usage table is server bookkeeping: it has no browser store collection, map/load path, or realtime subscription. No diary schema changes.

## Configuration and rollout

1. Set `OPENAI_API_KEY` locally and in Vercel Production/Preview as needed. Never use a `VITE_` prefix. Existing Supabase URL/publishable-key variables remain required server-side too.
2. Apply `supabase/migrations/20261117112443_tonight_usage.sql` using the repo migration workflow or `supabase db push --remote --yes` against the intended linked project (CLI v3 defaults to local). Applied to the linked We Saw production project on 17 November 2026; migration history and quota-table/RPC permissions were verified afterward. The API requires the quota function; it will not spend without it.
3. Deploy/redeploy the app. No OpenAI SDK or new browser dependency is needed.
4. Verify an authenticated household can generate a pick and that an unauthenticated POST returns 401. Check title details and logging from a result.

Requests send anonymous viewer labels, catalog metadata and scores, plus the text the user explicitly enters. Account IDs, names, diary notes and watch dates are not sent. Free text can contain personal data if the user enters it. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data): API data is not used for training by default; `store: false` does not eliminate abuse-monitoring retention. Key rotation is recommended for any credential pasted into chat.

## Validation and evaluation

Implementation verification: 83 unit/component tests passed, along with formatting, lint (three existing warnings), TypeScript, production build and bundle budgets. Disposable Postgres checks passed for authentication, cooldown, daily cap, tenant isolation, write protection and next-day reset. Live synthetic model requests passed for two-viewer taste evidence, empty history, and an attempted instruction to invent a title; these took approximately 3–6 seconds. A mobile synthetic-data fixture verified results, skipping and drawer dismissal. Full authenticated household UI testing remains pending. The remote quota migration was subsequently applied and verified through the authenticated CLI; the connector still requires reauthentication.

Run the required format/lint/typecheck/test/build commands and bundle check. API tests mock external network boundaries while exercising real auth/tenancy/filter/output handling. Component tests exercise cancellation, filters, skips and fallback. `tests/tonight-usage.sql` is for a disposable local Postgres database only; it validates the quota and RLS in a rolled-back transaction.

Before claiming better recommendations, compare the existing ranking and AI on representative prompts and unseen ratings: constraint violations, unsupported explanation claims, both-viewer suitability, pick acceptance, subsequent scores, latency and tokens. Keep failures and sparse-history cases in the evaluation set. See [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Live synthetic checks validate the API contract, not personal recommendation accuracy.
