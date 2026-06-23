import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getReviewState, recordReview, getDueItems } from "./reviews";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE reviews (id INTEGER PRIMARY KEY,
      item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL NOT NULL DEFAULT 2.5, interval_days INTEGER NOT NULL DEFAULT 0,
      due_date TEXT, last_reviewed TEXT, UNIQUE(item_type, item_id));
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, lc_url TEXT, difficulty TEXT NOT NULL);
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (1,'Two Sum','u1','Easy')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (1,'Sliding Window','sliding-window')").run();
});

describe("getReviewState", () => {
  it("returns the default for an unseen item", () => {
    expect(getReviewState(db, "problem", 1)).toEqual({ ease: 2.5, intervalDays: 0 });
  });
});

describe("recordReview", () => {
  it("creates a review row with computed interval and due date", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22");
    const row = db.prepare("SELECT * FROM reviews WHERE item_type='problem' AND item_id=1").get() as any;
    expect(row.interval_days).toBe(3);
    expect(row.due_date).toBe("2026-06-25");
    expect(row.last_reviewed).toBe("2026-06-22");
  });

  it("upserts (no duplicate) and advances the schedule on the second review", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // interval 3
    recordReview(db, "problem", 1, "ok", "2026-06-25"); // interval round(3*2.5)=8
    const rows = db.prepare("SELECT * FROM reviews WHERE item_type='problem' AND item_id=1").all();
    expect(rows.length).toBe(1);
    expect(getReviewState(db, "problem", 1)).toEqual({ ease: 2.5, intervalDays: 8 });
  });

  it("keeps problem and pattern schedules independent", () => {
    recordReview(db, "problem", 1, "easy", "2026-06-22");
    recordReview(db, "pattern", 1, "hard", "2026-06-22");
    expect(getReviewState(db, "problem", 1).intervalDays).toBe(4);
    expect(getReviewState(db, "pattern", 1).intervalDays).toBe(1);
  });
});

describe("getDueItems", () => {
  it("returns problems and patterns due on or before today, with display fields", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // due 2026-06-25
    recordReview(db, "pattern", 1, "hard", "2026-06-22"); // due 2026-06-23
    const due = getDueItems(db, "2026-06-25");
    expect(due.map((d) => `${d.item_type}:${d.item_id}`).sort()).toEqual([
      "pattern:1",
      "problem:1",
    ]);
    const problem = due.find((d) => d.item_type === "problem")!;
    expect(problem.title).toBe("Two Sum");
    expect(problem.lc_url).toBe("u1");
    const pattern = due.find((d) => d.item_type === "pattern")!;
    expect(pattern.title).toBe("Sliding Window");
    expect(pattern.slug).toBe("sliding-window");
  });

  it("excludes items not yet due", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // due 2026-06-25
    expect(getDueItems(db, "2026-06-24")).toEqual([]);
  });
});
