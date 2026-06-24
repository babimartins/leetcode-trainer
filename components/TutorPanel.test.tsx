import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TutorPanel } from "./TutorPanel";

const noop = async () => {};

describe("TutorPanel", () => {
  it("renders existing messages", () => {
    render(
      <TutorPanel
        slug="sliding-window"
        messages={[
          { id: 1, role: "user", content: "what triggers sliding window?" },
          { id: 2, role: "assistant", content: "contiguous subarray problems" },
        ]}
        action={noop}
      />
    );
    expect(screen.getByText("what triggers sliding window?")).toBeInTheDocument();
    expect(screen.getByText("contiguous subarray problems")).toBeInTheDocument();
  });

  it("shows an empty-state hint with no messages and disables Send until typed", () => {
    render(<TutorPanel slug="sliding-window" messages={[]} action={noop} />);
    expect(screen.getByText(/ask the tutor/i)).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/ask about/i), {
      target: { value: "explain the window invariant" },
    });
    expect(send).toBeEnabled();
  });

  it("Teach it back fills the input", () => {
    const { container } = render(
      <TutorPanel slug="sliding-window" messages={[]} action={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Teach it back" }));
    const input = container.querySelector(
      'input[name="body"]'
    ) as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);
  });

  it("carries the slug in a hidden field", () => {
    const { container } = render(
      <TutorPanel slug="sliding-window" messages={[]} action={noop} />
    );
    const hidden = container.querySelector(
      'input[type="hidden"][name="slug"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("sliding-window");
  });
});
