import type Database from "better-sqlite3";

export interface NoteRow {
  id: number;
  pattern_id: number;
  section_key: string;
  body: string;
}

export function listNotesForPattern(
  db: Database.Database,
  patternId: number
): NoteRow[] {
  return db
    .prepare(
      "SELECT id, pattern_id, section_key, body FROM notes WHERE pattern_id = ? ORDER BY id"
    )
    .all(patternId) as NoteRow[];
}

export function addNote(
  db: Database.Database,
  patternId: number,
  sectionKey: string,
  body: string
): NoteRow {
  const info = db
    .prepare(
      "INSERT INTO notes (pattern_id, section_key, body) VALUES (?, ?, ?)"
    )
    .run(patternId, sectionKey, body);
  return db
    .prepare("SELECT id, pattern_id, section_key, body FROM notes WHERE id = ?")
    .get(info.lastInsertRowid) as NoteRow;
}

export function deleteNote(db: Database.Database, noteId: number): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
}
