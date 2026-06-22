import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listPatterns, getPatternBySlug } from "./patterns";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE patterns (
       id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
       content_path TEXT, status TEXT NOT NULL DEFAULT 'not_started',
       ordering INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now')));`
  );
  db.prepare(
    "INSERT INTO patterns (name, slug, status, ordering) VALUES (?,?,?,?)"
  ).run("Binary Search", "binary-search", "not_started", 2);
  db.prepare(
    "INSERT INTO patterns (name, slug, status, ordering) VALUES (?,?,?,?)"
  ).run("Sliding Window", "sliding-window", "learning", 1);
});

describe("listPatterns", () => {
  it("returns patterns ordered by ordering then name", () => {
    const rows = listPatterns(db);
    expect(rows.map((r) => r.slug)).toEqual(["sliding-window", "binary-search"]);
    expect(rows[0].status).toBe("learning");
  });
});

describe("getPatternBySlug", () => {
  it("returns the matching pattern", () => {
    expect(getPatternBySlug(db, "binary-search")?.name).toBe("Binary Search");
  });
  it("returns null when not found", () => {
    expect(getPatternBySlug(db, "nope")).toBeNull();
  });
});
