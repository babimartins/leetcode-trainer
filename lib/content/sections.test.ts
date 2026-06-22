import { describe, it, expect } from "vitest";
import { slugify, splitSections } from "./sections";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("When to reach for it")).toBe("when-to-reach-for-it");
  });
  it("collapses non-alphanumeric runs and trims hyphens", () => {
    expect(slugify("Graphs / BFS · DFS!")).toBe("graphs-bfs-dfs");
  });
});

describe("splitSections", () => {
  it("splits on ## headings with slugified keys and trimmed bodies", () => {
    const md = [
      "## Intuition",
      "",
      "Slide a window.",
      "",
      "## Common pitfalls",
      "",
      "- forgetting to shrink",
    ].join("\n");

    const sections = splitSections(md);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({
      key: "intuition",
      title: "Intuition",
      body: "Slide a window.",
    });
    expect(sections[1]).toEqual({
      key: "common-pitfalls",
      title: "Common pitfalls",
      body: "- forgetting to shrink",
    });
  });

  it("captures content before the first heading as an Overview section", () => {
    const md = ["Intro line.", "", "## Intuition", "", "Body."].join("\n");
    const sections = splitSections(md);
    expect(sections[0]).toEqual({
      key: "overview",
      title: "Overview",
      body: "Intro line.",
    });
    expect(sections[1].key).toBe("intuition");
  });

  it("returns an empty array for empty input", () => {
    expect(splitSections("   \n  ")).toEqual([]);
  });
});
