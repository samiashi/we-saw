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
  year: "2020",
} as unknown as Title;
const props = { titles: [title], history: [], people: [], onOpen: vi.fn() };
afterEach(cleanup);
describe("Tonight picker", () => {
  it("does not call the model on mount, and falls back after failure", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("AI unavailable"));
    render(<TonightPicker {...props} generate={generate} />);
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await waitFor(() => expect(screen.getByText("Picnic")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("AI unavailable");
    expect(screen.getByText(/Mood preferences were not applied/)).toBeInTheDocument();
  });
  it("does not show an overlong fallback when a time limit is selected", async () => {
    render(
      <TonightPicker {...props} generate={vi.fn().mockRejectedValue(new Error("Unavailable"))} />,
    );
    fireEvent.change(screen.getByLabelText("Time available"), { target: { value: "60" } });
    expect(screen.getByRole("button", { name: "Find picks" })).toBeDisabled();
    expect(screen.queryByText("Picnic")).not.toBeInTheDocument();
  });
  it("clears old picks when preferences change and keeps dismissals session-only", async () => {
    const generate = vi.fn().mockResolvedValue({
      picks: [{ key: "movie:1", reason: "A light comedy.", caveat: "", evidence: [] }],
      candidateCount: 1,
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
    });
    render(<TonightPicker {...props} titles={[title, second]} generate={generate} />);
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    await screen.findByText("First option");
    fireEvent.click(screen.getByRole("button", { name: "Not tonight: Picnic" }));
    expect(screen.queryByText("First option")).not.toBeInTheDocument();
    expect(screen.getByText("Second option")).toBeInTheDocument();
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
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Find picks" })).toBeEnabled());
    expect(screen.queryByText("Late result")).not.toBeInTheDocument();
  });
});
