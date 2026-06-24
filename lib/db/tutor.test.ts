import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  findTutorSession,
  getOrCreateTutorSession,
  listTutorMessages,
  addTutorMessage,
} from "./tutor";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE tutor_sessions (id INTEGER PRIMARY KEY,
      scope_type TEXT NOT NULL, scope_id INTEGER NOT NULL, title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE tutor_messages (id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
});

describe("tutor sessions", () => {
  it("findTutorSession returns null when none exists", () => {
    expect(findTutorSession(db, "pattern", 1)).toBeNull();
  });

  it("getOrCreateTutorSession creates once and reuses", () => {
    const a = getOrCreateTutorSession(db, "pattern", 1);
    const b = getOrCreateTutorSession(db, "pattern", 1);
    expect(a).toBe(b);
    expect(findTutorSession(db, "pattern", 1)).toBe(a);
    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM tutor_sessions").get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("keeps sessions distinct per scope", () => {
    const p = getOrCreateTutorSession(db, "pattern", 1);
    const q = getOrCreateTutorSession(db, "problem", 1);
    expect(p).not.toBe(q);
  });
});

describe("tutor messages", () => {
  it("adds and lists messages in order", () => {
    const sid = getOrCreateTutorSession(db, "pattern", 1);
    const m1 = addTutorMessage(db, sid, "user", "explain sliding window");
    expect(m1.id).toBeGreaterThan(0);
    addTutorMessage(db, sid, "assistant", "It maintains a contiguous window...");
    const rows = listTutorMessages(db, sid);
    expect(rows.map((r) => `${r.role}:${r.content}`)).toEqual([
      "user:explain sliding window",
      "assistant:It maintains a contiguous window...",
    ]);
  });
});
