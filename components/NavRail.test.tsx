import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavRail } from "./NavRail";

describe("NavRail", () => {
  it("renders all primary destinations with correct hrefs", () => {
    render(<NavRail />);
    const expected: Array<[string, string]> = [
      ["Today", "/"],
      ["Patterns", "/patterns"],
      ["Problems", "/problems"],
      ["Review queue", "/review"],
      ["Stats", "/stats"],
      ["Settings", "/settings"],
    ];
    for (const [label, href] of expected) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
    }
  });
});
