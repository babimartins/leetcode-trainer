import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { attemptCountsByDay } from "./activity";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL,
       date TEXT NOT NULL, outcome TEXT NOT NULL DEFAULT 'solved');`
  );
  const ins = db.prepare("INSERT INTO attempts (problem_id, date) VALUES (1, ?)");
  ins.run("2026-06-24 09:00:00");
  ins.run("2026-06-24 18:00:00");
  ins.run("2026-06-22 10:00:00");
  ins.run("2026-06-10 10:00:00"); // before sinceDay
});

describe("attemptCountsByDay", () => {
  it("counts attempts per day from sinceDay onward", () => {
    expect(attemptCountsByDay(db, "2026-06-20")).toEqual({
      "2026-06-22": 1,
      "2026-06-24": 2,
    });
  });

  it("returns an empty map when nothing is in range", () => {
    expect(attemptCountsByDay(db, "2026-07-01")).toEqual({});
  });
});
