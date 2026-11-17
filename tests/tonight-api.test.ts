import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCatalog } from "../server/catalog.js";

const env = {
  OPENAI_API_KEY: "test-key",
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
      if (url.includes("/rest/v1/list_items"))
        return Response.json(
          options.empty
            ? []
            : [
                { title_id: "movie:1", status: "queued", title: { payload: title } },
                {
                  title_id: "movie:2",
                  status: "queued",
                  title: { payload: { ...title, key: "movie:2", runtimeMinutes: 150 } },
                },
                {
                  title_id: "movie:3",
                  status: "queued",
                  title: { payload: { ...title, key: "movie:3", runtimeMinutes: null } },
                },
              ],
        );
      if (url.includes("/rest/v1/watches"))
        return Response.json([
          {
            id: "watch-1",
            watchers: ["person-a"],
            title: { payload: title },
            ratings: [{ user_id: "person-a", score: 9 }],
            note: "Private note never sent",
          },
        ]);
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
                          evidence: ["movie:1"],
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
    expect(context.candidates.map((c: { key: string }) => c.key)).toEqual(["movie:1"]);
    expect(
      calls
        .filter((c) => /list_items|watches/.test(c.url))
        .every((c) => new URL(c.url).searchParams.get("household_id") === "eq.home-a"),
    ).toBe(true);
  });
  it("does not spend quota or call OpenAI when no candidates fit", async () => {
    const calls = setup({ empty: true });
    const result = await handleCatalog(request);
    expect(result.body).toMatchObject({ picks: [], candidateCount: 0 });
    expect(calls.some((c) => /openai.com|consume_tonight/.test(c.url))).toBe(false);
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
