// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { TasteAnalysisSection } from "@/components/stats/TasteAnalysisSection";
import { StoreContext, type WeSawStore } from "@/lib/store/context";
import type { Entry, TasteFilters, TasteResult } from "@/lib/types";

const filters: TasteFilters = { scopeId: "together", year: "all", type: "all" };
const result: TasteResult = {
  historyCount: 205,
  ratedCount: 180,
  missingMetadataCount: 0,
  insights: [
    {
      title: "A taste for mysteries",
      explanation: "Mysteries tend to suit one of you.",
      metrics: [
        { id: "m0", viewerId: "a", facet: "genres", name: "Mystery", count: 12, meanRating: 8.2 },
      ],
      evidence: [
        {
          id: "w1",
          titleKey: "movie:1",
          name: "Picnic",
          posterPath: null,
          watchedOn: null,
          ratings: { a: 9, b: 6 },
        },
      ],
    },
  ],
};
const entry = {
  watch: { id: "w1", watchers: ["a", "b"], watchedOn: null },
  title: { key: "movie:1", name: "Picnic" },
  scores: { a: 9, b: 6 },
} as unknown as Entry;
function app(
  generate: WeSawStore["requestTasteAnalysis"],
  selected = filters,
  entries = [entry],
  householdId = "home-a",
) {
  const store = {
    entries,
    people: [
      { id: "a", name: "Sam" },
      { id: "b", name: "Alex" },
    ],
    household: { id: householdId },
    userId: "a",
    nameFor: (id: string) => (id === "a" ? "Sam" : "Alex"),
    requestTasteAnalysis: generate,
  } as unknown as WeSawStore;
  return (
    <StoreContext.Provider value={store}>
      <TasteAnalysisSection filters={selected} />
    </StoreContext.Provider>
  );
}
afterEach(cleanup);

describe("Analyze my taste", () => {
  it("runs only on request, forwards filters and shows measured evidence with separate ratings", async () => {
    const generate = vi.fn().mockResolvedValue(result);
    render(app(generate));
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    await screen.findByText("A taste for mysteries");
    expect(generate).toHaveBeenCalledWith(filters, expect.any(AbortSignal));
    expect(screen.getByRole("status")).toHaveTextContent("205 matching watches (180 rated)");
    expect(screen.getByText("Sam · Mystery")).toBeInTheDocument();
    fireEvent.click(screen.getByText("See supporting watches"));
    expect(screen.getByText("Picnic")).toBeVisible();
    expect(screen.getByText("Sam 9")).toBeVisible();
    expect(screen.getByText("Alex 6")).toBeVisible();
  });
  it("clears old reports when any filter or the household history changes", async () => {
    const generate = vi.fn().mockResolvedValue(result);
    const view = render(app(generate));
    for (const next of [
      { ...filters, year: "2026" },
      { ...filters, type: "tv" as const },
      { ...filters, scopeId: "a" },
    ]) {
      fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
      await screen.findByText("A taste for mysteries");
      view.rerender(app(generate, next));
      expect(screen.queryByText("A taste for mysteries")).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    await screen.findByText("A taste for mysteries");
    view.rerender(
      app(generate, { ...filters, scopeId: "a" }, [{ ...entry, scores: { a: 2, b: 6 } }]),
    );
    expect(screen.queryByText("A taste for mysteries")).not.toBeInTheDocument();
  });
  it("cancels stale requests on filter changes and ignores late responses", async () => {
    let resolve!: (data: TasteResult) => void;
    const generate = vi.fn(
      (_filters: TasteFilters, _signal: AbortSignal) =>
        new Promise<TasteResult>((done) => {
          resolve = done;
        }),
    );
    const view = render(app(generate));
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    const signal = generate.mock.calls[0][1];
    view.rerender(app(generate, { ...filters, year: "2026" }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(result));
    expect(screen.queryByText("A taste for mysteries")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze my taste" })).toBeEnabled();
  });
  it("allows cancel without displaying the eventual response", async () => {
    let resolve!: (data: TasteResult) => void;
    const generate = vi.fn(
      () =>
        new Promise<TasteResult>((done) => {
          resolve = done;
        }),
    );
    render(app(generate));
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => resolve(result));
    expect(screen.queryByText("A taste for mysteries")).not.toBeInTheDocument();
  });
  it("shows retryable errors and honest empty states", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Please try again."))
      .mockResolvedValue({ ...result, historyCount: 0, ratedCount: 0, insights: [] });
    render(app(generate));
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Please try again."));
    fireEvent.click(screen.getByRole("button", { name: "Analyze my taste" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No watches match these filters"),
    );
  });
});
