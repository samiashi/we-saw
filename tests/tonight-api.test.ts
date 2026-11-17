import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCatalog } from "../server/catalog.js";

const env = {
  OPENAI_API_KEY: "test-key",
  TMDB_API_KEY: "catalog-key",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
};
const request = {
  query: { action: "tonight" },
  env,
  method: "POST",
  authorization: "Bearer session",
  origin: "http://localhost:4183",
  host: "localhost:4183",
  body: { mood: "Something light", type: "movie", maxMinutes: 100, excluded: [] },
};
const title = {
  key: "movie:1",
  type: "movie",
  name: "A gentle comedy",
  overview: "Friends reunite for a picnic.",
  genres: ["Comedy"],
  cast: [],
  directors: [],
  runtimeMinutes: 95,
  year: "2020",
  posterPath: null,
  seasons: [],
};
function setup(
  options: {
    quota?: boolean;
    model?: unknown;
    status?: number;
    empty?: boolean;
    invalidAuth?: boolean;
    watches?: unknown[];
    pageSize?: number;
    catalogFailure?: boolean;
    laterPageFailure?: boolean;
  } = {},
) {
  const calls: { url: string; body: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: String(init?.body ?? "") });
      if (url.includes("/auth/v1/user"))
        return Response.json(options.invalidAuth ? {} : { id: "person-a" }, {
          status: options.invalidAuth ? 401 : 200,
        });
      if (url.includes("/rest/v1/members"))
        return Response.json([
          { user_id: "person-a", household_id: "home-a" },
          { user_id: "person-b", household_id: "home-a" },
        ]);
      if (url.includes("/rest/v1/watches")) {
        const watches = options.watches ?? [
          {
            id: "watch-001",
            title_id: "movie:101",
            watchers: ["person-a"],
            title: {
              payload: {
                ...title,
                key: "movie:101",
                cast: ["A performer"],
                directors: ["A filmmaker"],
              },
            },
            ratings: [{ user_id: "person-a", score: 9 }],
            note: "Private note never sent",
          },
        ];
        const after = new URL(url).searchParams.get("id")?.slice(3);
        if (after && options.laterPageFailure) return Response.json({}, { status: 503 });
        return Response.json(
          watches
            .filter((w) => !after || (w as { id: string }).id > after)
            .slice(0, options.pageSize ?? 200),
        );
      }
      if (url.includes("api.themoviedb.org")) {
        if (options.catalogFailure) return Response.json({}, { status: 503 });
        const path = new URL(url).pathname;
        if (path.includes("/search/person"))
          return Response.json({
            results: [{ id: 42, name: new URL(url).searchParams.get("query") }],
          });
        if (path.includes("/combined_credits") && options.empty)
          return Response.json({ cast: [], crew: [] });
        if (path.includes("/combined_credits"))
          return Response.json({
            cast: [{ id: 1, media_type: "movie" }],
            crew: [{ id: 1, media_type: "movie", job: "Director" }],
          });
        if (path.includes("/genre/"))
          return Response.json({ genres: [{ id: 35, name: "Comedy" }] });
        if (/recommendations|discover/.test(path))
          return Response.json({
            results: options.empty ? [] : [1, 2, 3, 101].map((id) => ({ id, media_type: "movie" })),
          });
        const id = Number(path.split("/").at(-1));
        return Response.json({
          id,
          title: title.name,
          overview: title.overview,
          genres: [{ name: "Comedy" }],
          runtime: id === 1 ? 95 : id === 2 ? 150 : null,
          credits: {
            cast: [{ name: "A performer" }],
            crew: [{ job: "Director", name: "A filmmaker" }],
          },
        });
      }
      if (url.includes("/rpc/consume_tonight_request")) return Response.json(options.quota ?? true);
      if (url === "https://api.openai.com/v1/responses")
        return Response.json(
          options.model ?? {
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      picks: [
                        {
                          key: "movie:1",
                          reason: "A short comedy for a relaxed evening.",
                          caveat: "There is little rating history for your second viewer.",
                          evidence: options.watches ? [] : ["movie:101"],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
          { status: options.status ?? 200 },
        );
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("Tonight API", () => {
  it("requires an authenticated POST and keeps errors private", async () => {
    const calls = setup();
    expect((await handleCatalog({ ...request, method: "GET" })).status).toBe(405);
    const result = await handleCatalog({ ...request, authorization: "" });
    expect(result.status).toBe(401);
    expect(result.cacheControl).toContain("no-store");
    expect(calls).toHaveLength(0);
  });
  it("rejects an expired session before reading history or calling OpenAI", async () => {
    const calls = setup({ invalidAuth: true });
    expect((await handleCatalog(request)).status).toBe(401);
    expect(calls).toHaveLength(1);
  });
  it("enforces runtime on server data and sends only anonymized context", async () => {
    const calls = setup();
    const result = await handleCatalog(request);
    expect(result.status).toBe(200);
    expect(result.cacheControl).toContain("no-store");
    expect(result.body).toMatchObject({ picks: [{ key: "movie:1" }], candidateCount: 1 });
    const sent = JSON.parse(calls.find((c) => c.url.includes("openai.com"))!.body);
    expect(sent).toMatchObject({
      model: "gpt-6.1-sol",
      reasoning: { effort: "low" },
      store: false,
    });
    expect(sent.input).not.toContain("person-a");
    expect(sent.input).not.toContain("home-a");
    expect(sent.input).not.toContain("Private note");
    const context = JSON.parse(sent.input);
    expect(calls.some((c) => c.url.includes("list_items"))).toBe(false);
    expect(context.historyCount).toBe(1);
    expect(context.taste[0].facets.cast).toMatchObject([{ name: "A performer", meanRating: 9 }]);
    expect(context.candidates.map((c: { key: string }) => c.key)).toEqual(["movie:1"]);
    expect(
      calls
        .filter((c) => /list_items|watches/.test(c.url))
        .every((c) => new URL(c.url).searchParams.get("household_id") === "eq.home-a"),
    ).toBe(true);
  });
  it("does not call OpenAI when no catalog candidates fit", async () => {
    const calls = setup({ empty: true });
    const result = await handleCatalog(request);
    expect(result.body).toMatchObject({ picks: [], candidateCount: 0 });
    expect(calls.some((c) => /openai.com/.test(c.url))).toBe(false);
  });
  it("uses every page, including older ratings, without reading Up Next", async () => {
    const watches = Array.from({ length: 205 }, (_, index) => ({
      id: `watch-${String(index).padStart(4, "0")}`,
      title_id: `movie:${1000 + index}`,
      watchers: ["person-a"],
      seasons: null,
      title: {
        payload: {
          ...title,
          key: `movie:${1000 + index}`,
          cast: [index === 204 ? "Old favorite" : "Other actor"],
          directors: ["Repeated director"],
        },
      },
      ratings: [
        { user_id: "person-a", score: index === 204 ? 10 : 3 },
        { user_id: "person-b", score: 10 },
      ],
    }));
    const calls = setup({ watches, pageSize: 73 });
    const result = await handleCatalog(request);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ historyCount: 205, ratedCount: 205 });
    const context = JSON.parse(
      JSON.parse(calls.find((c) => c.url.includes("openai.com"))!.body).input,
    );
    expect(context.taste[0].ratedWatches).toBe(205);
    expect(context.taste[1].ratedWatches).toBe(0); // Non-watchers cannot supply taste evidence.
    expect(context.taste[0].facets.cast).toContainEqual(
      expect.objectContaining({ name: "Old favorite", meanRating: 10 }),
    );
    expect(context.taste[0].facets.directors).toMatchObject([{ count: 205 }]);
    expect(calls.some((c) => c.url.includes("/movie/1204/recommendations"))).toBe(true);
    expect(calls.filter((c) => c.url.includes("/rest/v1/watches"))).toHaveLength(4);
    expect(calls.some((c) => c.url.includes("list_items"))).toBe(false);
  });
  it("fails rather than silently using an incomplete history", async () => {
    const calls = setup({ laterPageFailure: true });
    expect((await handleCatalog(request)).status).toBe(502);
    expect(calls.some((c) => /openai.com|themoviedb/.test(c.url))).toBe(false);
  });
  it("does not spend or call the catalog for an empty diary", async () => {
    const calls = setup({ watches: [] });
    expect((await handleCatalog(request)).body).toMatchObject({
      historyCount: 0,
      picks: [],
      titles: [],
    });
    expect(calls.some((c) => /openai.com|themoviedb|consume_tonight/.test(c.url))).toBe(false);
  });
  it("excludes logged titles even if nobody rated them", async () => {
    const calls = setup({
      watches: [
        {
          id: "watch-1",
          title_id: "movie:1",
          watchers: ["person-a"],
          title: { payload: title },
          ratings: [],
        },
      ],
    });
    expect((await handleCatalog(request)).body).toMatchObject({
      historyCount: 1,
      ratedCount: 0,
      picks: [],
      titles: [],
    });
    expect(calls.some((c) => c.url.includes("openai.com"))).toBe(false);
  });
  it("reports a catalog outage instead of claiming no titles fit", async () => {
    const calls = setup({ catalogFailure: true });
    expect((await handleCatalog(request)).status).toBe(502);
    expect(calls.some((c) => c.url.includes("openai.com"))).toBe(false);
  });
  it("enforces durable quota before a paid call", async () => {
    const calls = setup({ quota: false });
    expect((await handleCatalog(request)).status).toBe(429);
    expect(calls.some((c) => c.url.includes("openai.com"))).toBe(false);
  });
  it("rejects invented title IDs", async () => {
    setup({
      model: {
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  picks: [{ key: "movie:999", reason: "Invented", caveat: "", evidence: [] }],
                }),
              },
            ],
          },
        ],
      },
    });
    const result = await handleCatalog(request);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("movie:999");
  });
  it("never relays upstream errors or secrets to the client", async () => {
    setup({ status: 500, model: { error: { message: "secret test-key" } } });
    const result = await handleCatalog(request);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("test-key");
  });
  it("rejects oversized or invalid preferences before fetching", async () => {
    const calls = setup();
    expect(
      (await handleCatalog({ ...request, body: { ...request.body, mood: "x".repeat(501) } }))
        .status,
    ).toBe(400);
    expect(
      (await handleCatalog({ ...request, body: { ...request.body, maxMinutes: -1 } })).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it.each([
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }],
    },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }],
    },
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                picks: [{ key: "movie:1", reason: "Okay", caveat: "", evidence: ["movie:999"] }],
              }),
            },
          ],
        },
      ],
    },
  ])("fails safely for incomplete, refused or invalid structured output", async (model) => {
    setup({ model });
    expect((await handleCatalog(request)).status).toBe(502);
  });
  it("respects not-tonight exclusions", async () => {
    const calls = setup();
    const result = await handleCatalog({
      ...request,
      body: { ...request.body, excluded: ["movie:1"] },
    });
    expect(result.body).toMatchObject({ picks: [], candidateCount: 0 });
    expect(calls.some((c) => c.url.includes("openai.com"))).toBe(false);
  });
});
