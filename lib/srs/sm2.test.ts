import { describe, it, expect } from "vitest";
import { nextReview } from "./sm2";

describe("nextReview — first review (intervalDays 0)", () => {
  it("ok sets 3 days, ease unchanged", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "ok")).toEqual({
      ease: 2.5,
      intervalDays: 3,
    });
  });
  it("easy sets 4 days and raises ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "easy")).toEqual({
      ease: 2.65,
      intervalDays: 4,
    });
  });
  it("hard sets 1 day and lowers ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "hard")).toEqual({
      ease: 2.3,
      intervalDays: 1,
    });
  });
});

describe("nextReview — subsequent reviews", () => {
  it("ok multiplies interval by ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 3 }, "ok")).toEqual({
      ease: 2.5,
      intervalDays: 8, // round(7.5)
    });
  });
  it("easy raises ease then grows interval", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 8 }, "easy")).toEqual({
      ease: 2.65,
      intervalDays: 28, // round(8 * 2.65 * 1.3)
    });
  });
  it("hard lowers ease and shrinks interval growth", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 8 }, "hard")).toEqual({
      ease: 2.3,
      intervalDays: 10, // max(1, round(9.6))
    });
  });
  it("floors ease at 1.3", () => {
    expect(nextReview({ ease: 1.3, intervalDays: 5 }, "hard").ease).toBe(1.3);
  });
});
