import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPatternContent } from "./loadPattern";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadPatternContent", () => {
  it("returns file contents for an existing slug", () => {
    fs.writeFileSync(path.join(dir, "sliding-window.md"), "## Intuition\n\nHi.");
    expect(loadPatternContent("sliding-window", dir)).toBe("## Intuition\n\nHi.");
  });

  it("returns null for a missing slug", () => {
    expect(loadPatternContent("nope", dir)).toBeNull();
  });
});
