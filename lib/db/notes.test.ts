import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listNotesForPattern, addNote, deleteNote } from "./notes";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE notes (
       id INTEGER PRIMARY KEY, pattern_id INTEGER NOT NULL, section_key TEXT NOT NULL,
       body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now')));`
  );
});

describe("notes helpers", () => {
  it("adds a note and returns the created row", () => {
    const note = addNote(db, 1, "intuition", "lead with amortized O(n)");
    expect(note.id).toBeGreaterThan(0);
    expect(note).toMatchObject({
      pattern_id: 1,
      section_key: "intuition",
      body: "lead with amortized O(n)",
    });
  });

  it("lists notes for a pattern in insertion order", () => {
    addNote(db, 1, "intuition", "first");
    addNote(db, 1, "template", "second");
    addNote(db, 2, "intuition", "other pattern");
    const rows = listNotesForPattern(db, 1);
    expect(rows.map((r) => r.body)).toEqual(["first", "second"]);
  });

  it("deletes a note by id", () => {
    const note = addNote(db, 1, "intuition", "temp");
    deleteNote(db, note.id);
    expect(listNotesForPattern(db, 1)).toEqual([]);
  });
});
