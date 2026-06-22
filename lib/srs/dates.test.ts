import { describe, it, expect } from "vitest";
import { addDays } from "./dates";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-06-22", 3)).toBe("2026-06-25");
  });
  it("rolls over a month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("subtracts days", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
});
