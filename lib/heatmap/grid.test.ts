import { describe, it, expect } from "vitest";
import { buildHeatmap } from "./grid";

describe("buildHeatmap", () => {
  it("returns weeks*7 chronological cells ending at endDay", () => {
    const cells = buildHeatmap(
      { "2026-06-24": 3, "2026-06-23": 1 },
      "2026-06-24",
      2
    );
    expect(cells).toHaveLength(14);
    expect(cells[13]).toEqual({ day: "2026-06-24", count: 3 });
    expect(cells[12]).toEqual({ day: "2026-06-23", count: 1 });
    expect(cells[0]).toEqual({ day: "2026-06-11", count: 0 });
  });

  it("defaults missing days to zero", () => {
    const cells = buildHeatmap({}, "2026-06-24", 1);
    expect(cells).toHaveLength(7);
    expect(cells.every((c) => c.count === 0)).toBe(true);
    expect(cells[6].day).toBe("2026-06-24");
  });
});
