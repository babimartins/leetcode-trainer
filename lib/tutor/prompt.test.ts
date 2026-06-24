import { describe, it, expect } from "vitest";
import { buildTutorSystem } from "./prompt";

describe("buildTutorSystem", () => {
  it("names the pattern and embeds the study material", () => {
    const s = buildTutorSystem("Sliding Window", "## Intuition\nSlide a window.");
    expect(s).toContain("Sliding Window");
    expect(s).toContain("Slide a window.");
    expect(s.toLowerCase()).toContain("tutor");
  });

  it("notes when there is no study material", () => {
    const s = buildTutorSystem("Sliding Window", "");
    expect(s).toContain("Sliding Window");
    expect(s.toLowerCase()).toContain("no study material");
  });
});
