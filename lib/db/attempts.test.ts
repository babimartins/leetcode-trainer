import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  statusForOutcome,
  logAttempt,
  listAttemptsForProblem,
} from "./attempts";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      difficulty TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY,
      problem_id INTEGER NOT NULL, date TEXT NOT NULL DEFAULT (datetime('now')),
      outcome TEXT NOT NULL, rating TEXT, minutes INTEGER,
      used_hint INTEGER NOT NULL DEFAULT 0, reflection TEXT);
  `);
  db.prepare("INSERT INTO problems (id,title,difficulty) VALUES (1,'P','Medium')").run();
});

describe("statusForOutcome", () => {
  it("maps solved to solved, partial/failed to solving", () => {
    expect(statusForOutcome("solved")).toBe("solved");
    expect(statusForOutcome("partial")).toBe("solving");
    expect(statusForOutcome("failed")).toBe("solving");
  });
});

describe("logAttempt", () => {
  it("inserts an attempt and returns the created row", () => {
    const row = logAttempt(db, {
      problemId: 1,
      outcome: "solved",
      rating: "ok",
      minutes: 28,
      usedHint: true,
      reflection: "forgot to shrink",
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row).toMatchObject({
      problem_id: 1,
      outcome: "solved",
      rating: "ok",
      minutes: 28,
      used_hint: 1,
      reflection: "forgot to shrink",
    });
  });

  it("updates the problem status from the outcome", () => {
    logAttempt(db, { problemId: 1, outcome: "partial" });
    const status = (
      db.prepare("SELECT status FROM problems WHERE id = 1").get() as {
        status: string;
      }
    ).status;
    expect(status).toBe("solving");
  });

  it("defaults used_hint to 0 and nullable fields to null", () => {
    const row = logAttempt(db, { problemId: 1, outcome: "failed" });
    expect(row.used_hint).toBe(0);
    expect(row.rating).toBeNull();
    expect(row.minutes).toBeNull();
    expect(row.reflection).toBeNull();
  });
});

describe("listAttemptsForProblem", () => {
  it("returns attempts newest first", () => {
    logAttempt(db, { problemId: 1, outcome: "failed" });
    logAttempt(db, { problemId: 1, outcome: "solved" });
    const rows = listAttemptsForProblem(db, 1);
    expect(rows.map((r) => r.outcome)).toEqual(["solved", "failed"]);
  });
});
