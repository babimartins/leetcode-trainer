import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { studyStats, weakestPatterns, dueForReview, recentActivity } from "@/mcp/studyData";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT, minutes INTEGER, used_hint INTEGER DEFAULT 0, reflection TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','learning',2)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (3,'Graphs','graphs','not_started',3)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (2,'Koko','Medium','solving')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (1,1,'2026-06-24 10:00:00','solved','ok')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (2,2,'2026-06-25 09:00:00','partial','hard')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',1,1.8,3,'2026-06-28','2026-06-25')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',2,2.5,8,'2026-07-03','2026-06-25')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('problem',1,2.5,1,'2026-06-20','2026-06-19')").run();
});

describe("studyStats", () => {
  it("summarizes progress", () => {
    const s = studyStats(db, "2026-06-25");
    expect(s.solved).toBe(1);
    expect(s.totalAttempts).toBe(2);
    expect(s.patternsTotal).toBe(3);
    expect(s.patternsStarted).toBe(2);
    expect(s.streak).toBe(2); // attempts on 06-24 and 06-25
    expect(s.due).toBe(1); // problem review due 06-20 <= today
    expect(s.solvedByDifficulty).toEqual([{ difficulty: "Easy", solved: 1 }]);
  });
});

describe("weakestPatterns", () => {
  it("ranks reviewed patterns by lowest ease, then unreviewed last", () => {
    const rows = weakestPatterns(db, 5);
    expect(rows.map((r) => r.slug)).toEqual(["sliding-window", "binary-search", "graphs"]);
  });
  it("respects the limit", () => {
    expect(weakestPatterns(db, 1).map((r) => r.slug)).toEqual(["sliding-window"]);
  });
});

describe("dueForReview", () => {
  it("returns items due on or before today", () => {
    const due = dueForReview(db, "2026-06-25");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ item_type: "problem", item_id: 1 });
  });
});

describe("recentActivity", () => {
  it("returns recent attempts newest-first", () => {
    const rows = recentActivity(db, 10);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
  });
});
