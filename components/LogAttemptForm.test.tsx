import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogAttemptForm } from "./LogAttemptForm";

const noop = async () => {};

function setup() {
  return render(
    <LogAttemptForm
      problemId={7}
      problemTitle="Minimum Window Substring"
      lcUrl="https://leetcode.com/problems/minimum-window-substring/"
      difficulty="Hard"
      revalidate="/problems"
      action={noop}
    />
  );
}

describe("LogAttemptForm", () => {
  it("renders the title as a link to LeetCode opening in a new tab", () => {
    setup();
    const link = screen.getByRole("link", { name: /Minimum Window Substring/ });
    expect(link).toHaveAttribute(
      "href",
      "https://leetcode.com/problems/minimum-window-substring/"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a plain title (no link) when lcUrl is null", () => {
    render(
      <LogAttemptForm
        problemId={7}
        problemTitle="No URL Problem"
        lcUrl={null}
        revalidate="/problems"
        action={noop}
      />
    );
    expect(screen.queryByRole("link", { name: /No URL Problem/ })).toBeNull();
    expect(screen.getByText("No URL Problem")).toBeInTheDocument();
  });

  it("opens the form on Log and disables submit until an outcome is chosen", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Log attempt" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));

    const submit = screen.getByRole("button", { name: "Log attempt" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Solved" }));
    expect(submit).toBeEnabled();
  });

  it("reflects the chosen outcome in the hidden input", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    fireEvent.click(screen.getByRole("button", { name: "Partial" }));
    const hidden = container.querySelector(
      'input[type="hidden"][name="outcome"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("partial");
  });
});
