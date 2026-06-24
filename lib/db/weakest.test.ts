import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { weakestPattern } from "./weakest";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
      ordering INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL NOT NULL DEFAULT 2.5, due_date TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (1,'Sliding Window','sliding-window',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (2,'Binary Search','binary-search',2)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (3,'Graphs','graphs',3)").run();
});

describe("weakestPattern", () => {
  it("returns the reviewed pattern with the lowest ease", () => {
    db.prepare("INSERT INTO reviews (item_type,item_id,ease,due_date) VALUES ('pattern',1,2.5,'2026-06-30')").run();
    db.prepare("INSERT INTO reviews (item_type,item_id,ease,due_date) VALUES ('pattern',2,1.8,'2026-06-28')").run();
    expect(weakestPattern(db)).toEqual({ id: 2, name: "Binary Search", slug: "binary-search" });
  });

  it("falls back to the first pattern by ordering when none reviewed", () => {
    expect(weakestPattern(db)).toEqual({ id: 1, name: "Sliding Window", slug: "sliding-window" });
  });

  it("returns null when there are no patterns", () => {
    db.exec("DELETE FROM patterns");
    expect(weakestPattern(db)).toBeNull();
  });
});
