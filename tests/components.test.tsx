// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { RatingPicker } from "@/components/RatingPicker";
import { Toast } from "@/components/ui/toast";

afterEach(cleanup);

describe("RatingPicker", () => {
  it("renders ten scores and marks the selected one", () => {
    render(<RatingPicker value={7} onChange={() => {}} ariaLabel="Sam rating" />);

    expect(screen.getByRole("group", { name: "Sam rating" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "7" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "8" })).toHaveAttribute("aria-pressed", "false");
  });

  it("disables every score when disabled", () => {
    render(<RatingPicker value={null} onChange={() => {}} disabled />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});

describe("Toast", () => {
  it("announces the message", () => {
    render(<Toast message="Rated 8" />);

    expect(screen.getByRole("status")).toHaveTextContent("Rated 8");
  });

  it("renders nothing without a message", () => {
    const { container } = render(<Toast message="" />);

    expect(container).toBeEmptyDOMElement();
  });
});
