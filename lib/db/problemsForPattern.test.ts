import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listProblemsForPattern } from "./problemsForPattern";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      lc_slug TEXT, lc_url TEXT, difficulty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE problem_patterns (problem_id INTEGER NOT NULL, pattern_id INTEGER NOT NULL,
      PRIMARY KEY (problem_id, pattern_id));
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (?,?,?,?)").run(
    1, "Longest Substring", "https://lc/1", "Medium");
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (?,?,?,?)").run(
    2, "Two Sum", "https://lc/2", "Easy");
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (?,?)").run(1, 10);
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (?,?)").run(2, 99);
});

describe("listProblemsForPattern", () => {
  it("returns only problems mapped to the pattern, ordered by title", () => {
    const rows = listProblemsForPattern(db, 10);
    expect(rows.map((r) => r.title)).toEqual(["Longest Substring"]);
    expect(rows[0].difficulty).toBe("Medium");
  });
});
