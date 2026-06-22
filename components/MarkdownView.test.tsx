import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("renders headings, list items, and fenced code", () => {
    const md = [
      "## Intuition",
      "",
      "Slide a window over the array.",
      "",
      "- first point",
      "- second point",
      "",
      "```python",
      "def slide(s):",
      "    return s",
      "```",
    ].join("\n");

    const { container } = render(<MarkdownView markdown={md} />);

    expect(
      screen.getByRole("heading", { name: "Intuition" })
    ).toBeInTheDocument();
    expect(screen.getByText("first point")).toBeInTheDocument();
    // rehype-highlight tokenizes code into <span>s, so the text is split across
    // elements — assert against the code block's combined text content.
    const code = container.querySelector("pre code");
    expect(code?.textContent).toContain("def slide");
    expect(code?.className).toContain("language-python");
  });
});
