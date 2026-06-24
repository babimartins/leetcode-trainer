import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { solvedByDifficulty, totalAttempts, patternMastery } from "./statsPage";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, difficulty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started', ordering INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL, interval_days INTEGER);
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL, date TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('A','Easy','solved')").run();
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('B','Medium','solved')").run();
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('C','Medium','solving')").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days) VALUES ('pattern',1,2.3,8)").run();
  db.prepare("INSERT INTO attempts (problem_id) VALUES (1)").run();
  db.prepare("INSERT INTO attempts (problem_id) VALUES (1)").run();
});

describe("solvedByDifficulty", () => {
  it("counts solved problems per difficulty", () => {
    expect(solvedByDifficulty(db)).toEqual([
      { difficulty: "Easy", solved: 1 },
      { difficulty: "Medium", solved: 1 },
    ]);
  });
});

describe("totalAttempts", () => {
  it("counts all attempts", () => {
    expect(totalAttempts(db)).toBe(2);
  });
});

describe("patternMastery", () => {
  it("lists patterns with review ease/interval or null", () => {
    expect(patternMastery(db)).toEqual([
      { name: "Sliding Window", slug: "sliding-window", status: "learning", ease: 2.3, interval_days: 8 },
      { name: "Binary Search", slug: "binary-search", status: "not_started", ease: null, interval_days: null },
    ]);
  });
});
