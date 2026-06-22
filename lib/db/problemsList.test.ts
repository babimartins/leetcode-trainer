import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listProblems } from "./problemsList";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      lc_url TEXT, difficulty TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE problem_patterns (problem_id INTEGER, pattern_id INTEGER, PRIMARY KEY(problem_id,pattern_id));
    CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE problem_sources (problem_id INTEGER, source_id INTEGER, PRIMARY KEY(problem_id,source_id));
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')), outcome TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty,status) VALUES (1,'Two Sum','u1','Easy','solved')").run();
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty,status) VALUES (2,'Min Window','u2','Hard','not_started')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (1,'Hash Map','hash-map')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (2,'Sliding Window','sliding-window')").run();
  db.prepare("INSERT INTO problem_patterns VALUES (1,1)").run();
  db.prepare("INSERT INTO problem_patterns VALUES (2,2)").run();
  db.prepare("INSERT INTO sources (id,name) VALUES (1,'Blind 75')").run();
  db.prepare("INSERT INTO problem_sources VALUES (1,1)").run();
  db.prepare("INSERT INTO attempts (problem_id,outcome) VALUES (1,'failed')").run();
  db.prepare("INSERT INTO attempts (problem_id,outcome) VALUES (1,'solved')").run();
});

describe("listProblems", () => {
  it("returns all problems with patterns and latest outcome, ordered by title", () => {
    const rows = listProblems(db, {});
    expect(rows.map((r) => r.title)).toEqual(["Min Window", "Two Sum"]);
    const twoSum = rows.find((r) => r.id === 1)!;
    expect(twoSum.patterns).toBe("Hash Map");
    expect(twoSum.last_outcome).toBe("solved"); // newest attempt
    const minWindow = rows.find((r) => r.id === 2)!;
    expect(minWindow.last_outcome).toBeNull();
  });

  it("filters by difficulty", () => {
    expect(listProblems(db, { difficulty: "Hard" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by status", () => {
    expect(listProblems(db, { status: "solved" }).map((r) => r.id)).toEqual([1]);
  });

  it("filters by pattern slug", () => {
    expect(listProblems(db, { patternSlug: "sliding-window" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by source name", () => {
    expect(listProblems(db, { source: "Blind 75" }).map((r) => r.id)).toEqual([1]);
  });

  it("filters by case-insensitive title search", () => {
    expect(listProblems(db, { q: "window" }).map((r) => r.id)).toEqual([2]);
  });

  it("ignores empty-string filters", () => {
    expect(listProblems(db, { q: "", difficulty: "", status: "" }).length).toBe(2);
  });
});
