import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  dueCount,
  solvedCount,
  patternsProgress,
  currentStreak,
  lastAttemptedProblem,
} from "./stats";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, lc_url TEXT,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, due_date TEXT);
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL, date TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,status) VALUES (1,'A','u1','solved')").run();
  db.prepare("INSERT INTO problems (id,title,lc_url,status) VALUES (2,'B','u2','solving')").run();
  db.prepare("INSERT INTO patterns (id,status) VALUES (1,'learning'),(2,'not_started'),(3,'not_started')").run();
});

describe("dueCount", () => {
  it("counts reviews due on or before today", () => {
    db.prepare("INSERT INTO reviews (item_type,item_id,due_date) VALUES ('problem',1,'2026-06-20')").run();
    db.prepare("INSERT INTO reviews (item_type,item_id,due_date) VALUES ('problem',2,'2026-06-25')").run();
    expect(dueCount(db, "2026-06-22")).toBe(1);
  });
});

describe("solvedCount / patternsProgress", () => {
  it("counts solved problems and started patterns", () => {
    expect(solvedCount(db)).toBe(1);
    expect(patternsProgress(db)).toEqual({ started: 1, total: 3 });
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-22 09:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-21 10:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(3);
  });
  it("is zero when today has no attempt", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(0);
  });
  it("stops at the first gap", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-22 09:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(1);
  });
});

describe("lastAttemptedProblem", () => {
  it("returns the most recently attempted problem", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (2,'2026-06-21 11:00:00')").run();
    expect(lastAttemptedProblem(db)).toEqual({ id: 2, title: "B", lc_url: "u2" });
  });
  it("returns null with no attempts", () => {
    expect(lastAttemptedProblem(db)).toBeNull();
  });
});
