import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCatalog } from "../server/catalog.js";

let testId = 0;
function setup() {
  const state = {
    quota: true,
    auth: true,
    household: "home-a",
    failPage: false,
    invalidModel: false,
    modelFailure: false,
    pageSize: 2,
    watches: Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`,
      title_id: `movie:${i + 1}`,
      watchers: ["a", "b"],
      watched_on: i === 0 ? null : "2026-01-01",
      note: "Never send my note",
      title: {
        payload: {
          type: "movie",
          name: `Film ${i}`,
          year: "2000",
          genres: ["Mystery"],
          directors: ["Director"],
          cast: ["Actor"],
          originalLanguage: "en",
        },
      },
      ratings: [
        { user_id: "a", score: i === 0 ? 2 : 8 },
        { user_id: "b", score: 5 },
      ],
    })),
  };
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url: String(url), body });
      if (url.pathname === "/auth/v1/user")
        return Response.json(state.auth ? { id: "a" } : {}, { status: state.auth ? 200 : 401 });
      if (url.pathname.endsWith("/members"))
        return Response.json(
          ["a", "b"].map((user_id) => ({ user_id, household_id: state.household })),
        );
      if (url.pathname.endsWith("/watches")) {
        if (state.failPage && url.searchParams.has("id")) return Response.json({}, { status: 503 });
        const cursor = url.searchParams.get("id")?.slice(3) ?? "";
        return Response.json(state.watches.filter((w) => w.id > cursor).slice(0, state.pageSize));
      }
      if (url.pathname.endsWith("/consume_tonight_request")) return Response.json(state.quota);
      if (url.hostname === "api.openai.com") {
        if (state.modelFailure) return Response.json({}, { status: 500 });
        const context = JSON.parse(body.input);
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    insights: [
                      {
                        title: "A mystery pattern",
                        explanation:
                          "Mystery appears to suit one of you, although the evidence is still limited.",
                        metricIds: [state.invalidModel ? "invented" : context.metrics[0].id],
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        });
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    }),
  );
  const request = {
    query: { action: "taste" },
    method: "POST",
    origin: "http://localhost:4183",
    host: "localhost:4183",
    authorization: "Bearer session",
    env: {
      OPENAI_API_KEY: "test",
      VITE_SUPABASE_URL: `https://test-${++testId}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: "public",
    },
    body: { scopeId: "together", year: "all", type: "all" },
  };
  return { state, calls, request };
}
afterEach(() => vi.unstubAllGlobals());

describe("Taste API", () => {
  it("reads every short page, uses Sol low, and sends anonymous aggregates without notes", async () => {
    const { request, calls } = setup();
    const response = await handleCatalog(request);
    expect(response.status).toBe(200);
    expect(response.cacheControl).toBe("private, no-store");
    expect(response.body).toMatchObject({
      historyCount: 5,
      ratedCount: 5,
      insights: [{ metrics: [{ count: 5, meanRating: 6.8, viewerId: "a" }] }],
    });
    const pages = calls.filter((c) => c.url.includes("/watches"));
    expect(pages).toHaveLength(4);
    expect(
      pages.every((c) => new URL(c.url).searchParams.get("household_id") === "eq.home-a"),
    ).toBe(true);
    const model = calls.find((c) => c.url.includes("api.openai.com"))!.body!;
    expect(model).toMatchObject({
      model: "gpt-6.2-sol",
      reasoning: { effort: "medium" },
      store: false,
    });
    const input = String(model.input);
    expect(input).not.toContain("Never send my note");
    expect(input).not.toContain("home-a");
    expect(input).not.toContain("user_id");
    expect(input).not.toContain("viewerId");
    expect(calls.some((c) => c.url.includes("list_items"))).toBe(false);
  });
  it("respects filters server-side and rejects another household's person", async () => {
    const { state, request, calls } = setup();
    state.watches[1].watchers = ["a"];
    state.watches[2].watchers = ["a"];
    const response = await handleCatalog({
      ...request,
      body: { scopeId: "a", year: "2026", type: "movie" },
    });
    expect(response.body).toMatchObject({ historyCount: 2, ratedCount: 2 });
    const input = JSON.parse(
      String(calls.find((c) => c.url.includes("api.openai.com"))!.body!.input),
    );
    expect(input.filters).toEqual({ scope: "solo", year: "2026", type: "movie" });
    expect(input.profiles).toHaveLength(1);
    expect(
      (await handleCatalog({ ...request, body: { ...request.body, scopeId: "outsider" } })).status,
    ).toBe(403);
  });
  it("requires same-origin authenticated POST and valid filters before model work", async () => {
    const { state, calls, request } = setup();
    expect((await handleCatalog({ ...request, method: "GET" })).status).toBe(405);
    expect((await handleCatalog({ ...request, authorization: null })).status).toBe(401);
    expect((await handleCatalog({ ...request, origin: "https://other.test" })).status).toBe(403);
    expect(
      (await handleCatalog({ ...request, body: { ...request.body, year: "not-a-year" } })).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
    state.auth = false;
    expect((await handleCatalog(request)).status).toBe(401);
    expect(calls).toHaveLength(1);
  });
  it("never analyzes partial history or spends after denied quota", async () => {
    const { state, request, calls } = setup();
    state.failPage = true;
    expect((await handleCatalog(request)).status).toBe(502);
    state.failPage = false;
    state.quota = false;
    expect((await handleCatalog(request)).status).toBe(429);
    expect(calls.some((c) => c.url.includes("api.openai.com"))).toBe(false);
  });
  it("returns an honest empty state without spending when there is insufficient evidence", async () => {
    const { state, request, calls } = setup();
    state.watches = [];
    expect((await handleCatalog(request)).body).toMatchObject({ insights: [], historyCount: 0 });
    expect(calls.some((c) => /api.openai.com|consume_tonight/.test(c.url))).toBe(false);
  });
  it("rejects invented evidence and model failures without caching them", async () => {
    const { state, request } = setup();
    state.invalidModel = true;
    expect((await handleCatalog(request)).status).toBe(502);
    state.invalidModel = false;
    state.modelFailure = true;
    expect((await handleCatalog(request)).status).toBe(502);
    state.modelFailure = false;
    expect((await handleCatalog(request)).status).toBe(200);
  });
  it("reuses unchanged reports but revalidates auth/history and separates filters and households", async () => {
    const { state, request, calls } = setup();
    const modelCalls = () => calls.filter((c) => c.url.includes("api.openai.com")).length;
    expect((await handleCatalog(request)).status).toBe(200);
    expect((await handleCatalog(request)).status).toBe(200);
    expect(modelCalls()).toBe(1);
    expect(calls.filter((c) => c.url.includes("/auth/v1/user"))).toHaveLength(2);
    state.watches[0].ratings[0].score = 10;
    expect((await handleCatalog(request)).status).toBe(200);
    expect(modelCalls()).toBe(2);
    expect(
      (await handleCatalog({ ...request, body: { ...request.body, year: "2026" } })).status,
    ).toBe(200);
    expect(modelCalls()).toBe(3);
    state.household = "home-b";
    expect((await handleCatalog(request)).status).toBe(200);
    expect(modelCalls()).toBe(4);
    state.auth = false;
    expect((await handleCatalog(request)).status).toBe(401);
    expect(modelCalls()).toBe(4);
  });
});
