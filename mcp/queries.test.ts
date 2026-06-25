import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listRecentAttempts, listAllNotes, patternsWithReview } from "@/mcp/queries";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT, minutes INTEGER, used_hint INTEGER DEFAULT 0, reflection TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, pattern_id INTEGER, section_key TEXT, body TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating,minutes,used_hint,reflection) VALUES (1,1,'2026-06-24 10:00:00','solved','ok',12,0,'felt good')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (2,1,'2026-06-25 09:00:00','partial','hard')").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (1,1,'overview','expand and contract the window')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',1,1.8,3,'2026-06-28','2026-06-25')").run();
});

describe("listRecentAttempts", () => {
  it("returns attempts newest-first with the problem title", () => {
    const rows = listRecentAttempts(db, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(2);
    expect(rows[0].title).toBe("Two Sum");
    expect(rows[0].outcome).toBe("partial");
    expect(rows[1].rating).toBe("ok");
  });
});

describe("listAllNotes", () => {
  it("returns notes with their pattern name and slug", () => {
    const rows = listAllNotes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].pattern_name).toBe("Sliding Window");
    expect(rows[0].pattern_slug).toBe("sliding-window");
    expect(rows[0].body).toBe("expand and contract the window");
  });
});

describe("patternsWithReview", () => {
  it("joins each pattern to its pattern-review state (null when unreviewed)", () => {
    const rows = patternsWithReview(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ slug: "sliding-window", ease: 1.8, interval_days: 3, due_date: "2026-06-28" });
    expect(rows[1]).toMatchObject({ slug: "binary-search", ease: null, interval_days: null, due_date: null });
  });
});
