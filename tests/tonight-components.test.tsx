// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { TonightPicker } from "@/components/TonightPicker";
import type { Title, TonightResult } from "@/lib/types";

const title = {
  key: "movie:1",
  name: "Picnic",
  type: "movie",
  runtimeMinutes: 95,
  genres: ["Comedy"],
  directors: [],
  cast: [],
  seasons: [],
  posterPath: null,
  voteAverage: 7.8,
  year: "2020",
} as unknown as Title;
const props = { history: [], people: [], onOpen: vi.fn() };
afterEach(cleanup);
describe("Tonight picker", () => {
  it("does not call the model on mount or substitute queue picks after failure", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("AI unavailable"));
    render(<TonightPicker {...props} generate={generate} />);
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("AI unavailable"));
    expect(screen.getByRole("status")).toHaveTextContent("AI unavailable");
    expect(screen.queryByText("Picnic")).not.toBeInTheDocument();
  });
  it("can search the catalog with any filter and no queued titles", async () => {
    render(
      <TonightPicker {...props} generate={vi.fn().mockRejectedValue(new Error("Unavailable"))} />,
    );
    fireEvent.change(screen.getByLabelText("Time available"), { target: { value: "60" } });
    expect(screen.getByRole("button", { name: "Find picks" })).toBeEnabled();
    expect(screen.queryByText("Picnic")).not.toBeInTheDocument();
  });
  it("clears old picks when preferences change and keeps dismissals session-only", async () => {
    const generate = vi.fn().mockResolvedValue({
      picks: [{ key: "movie:1", reason: "A light comedy.", caveat: "", evidence: [] }],
      candidateCount: 1,
      titles: [title],
      historyCount: 200,
      ratedCount: 180,
    });
    render(<TonightPicker {...props} generate={generate} />);
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await screen.findByText("A light comedy.");
    fireEvent.click(screen.getByRole("button", { name: "Not tonight: Picnic" }));
    expect(screen.queryByText("Picnic")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset skipped titles" }));
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await screen.findByText("A light comedy.");
    fireEvent.click(screen.getByRole("button", { name: "Something gripping" }));
    expect(screen.queryByText("A light comedy.")).not.toBeInTheDocument();
  });
  it("keeps the other choices visible when one title is skipped", async () => {
    const second = { ...title, key: "movie:2", name: "Reunion" };
    const generate = vi.fn().mockResolvedValue({
      picks: [
        { key: "movie:1", reason: "First option", caveat: "", evidence: [] },
        { key: "movie:2", reason: "Second option", caveat: "", evidence: [] },
      ],
      candidateCount: 2,
      titles: [title, second],
      historyCount: 200,
      ratedCount: 180,
    });
    render(<TonightPicker {...props} generate={generate} />);
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await screen.findByText("First option");
    fireEvent.click(screen.getByRole("button", { name: "Not tonight: Picnic" }));
    expect(screen.queryByText("First option")).not.toBeInTheDocument();
    expect(screen.getByText("Second option")).toBeInTheDocument();
  });
  it("opens returned catalog metadata without a queued title", async () => {
    const onOpen = vi.fn();
    render(
      <TonightPicker
        {...props}
        onOpen={onOpen}
        generate={vi.fn().mockResolvedValue({
          picks: [{ key: title.key, reason: "From your history", caveat: "", evidence: [] }],
          titles: [title],
          candidateCount: 24,
          historyCount: 205,
          ratedCount: 180,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await screen.findByText("From your history");
    expect(screen.getByText("TMDB 7.8/10")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("205 logged watches (180 rated)");
    fireEvent.click(screen.getByRole("button", { name: "View title" }));
    expect(onOpen).toHaveBeenCalledWith(title);
  });
  it("explains what to do when the server has no watch history", async () => {
    render(
      <TonightPicker
        {...props}
        generate={vi.fn().mockResolvedValue({
          picks: [],
          titles: [],
          candidateCount: 0,
          historyCount: 0,
          ratedCount: 0,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Log and rate a few watches first"),
    );
  });
  it("ignores a result arriving after cancellation", async () => {
    let resolve!: (result: TonightResult) => void;
    const generate = () =>
      new Promise<TonightResult>((r) => {
        resolve = r;
      });
    render(<TonightPicker {...props} generate={generate} />);
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    resolve({
      picks: [{ key: "movie:1", reason: "Late result", caveat: "", evidence: [] }],
      candidateCount: 1,
      titles: [title],
      historyCount: 200,
      ratedCount: 180,
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Find picks" })).toBeEnabled());
    expect(screen.queryByText("Late result")).not.toBeInTheDocument();
  });
});
