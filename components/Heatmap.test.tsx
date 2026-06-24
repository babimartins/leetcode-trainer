import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Heatmap } from "./Heatmap";

describe("Heatmap", () => {
  it("renders one element per cell with its count", () => {
    const { container } = render(
      <Heatmap
        cells={[
          { day: "2026-06-23", count: 0 },
          { day: "2026-06-24", count: 5 },
        ]}
      />
    );
    const nodes = container.querySelectorAll("[data-count]");
    expect(nodes).toHaveLength(2);
    const busy = container.querySelector('[data-count="5"]');
    expect(busy).not.toBeNull();
    expect(busy!.getAttribute("title")).toContain("2026-06-24");
  });
});
