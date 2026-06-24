import type Database from "better-sqlite3";

export type TutorScope = "pattern" | "problem";

export interface TutorMessageRow {
  id: number;
  session_id: number;
  role: string;
  content: string;
}

export function findTutorSession(
  db: Database.Database,
  scope: TutorScope,
  scopeId: number
): number | null {
  const row = db
    .prepare(
      "SELECT id FROM tutor_sessions WHERE scope_type = ? AND scope_id = ? ORDER BY id LIMIT 1"
    )
    .get(scope, scopeId) as { id: number } | undefined;
  return row ? row.id : null;
}

export function getOrCreateTutorSession(
  db: Database.Database,
  scope: TutorScope,
  scopeId: number
): number {
  const existing = findTutorSession(db, scope, scopeId);
  if (existing !== null) return existing;
  const info = db
    .prepare("INSERT INTO tutor_sessions (scope_type, scope_id) VALUES (?, ?)")
    .run(scope, scopeId);
  return Number(info.lastInsertRowid);
}

export function listTutorMessages(
  db: Database.Database,
  sessionId: number
): TutorMessageRow[] {
  return db
    .prepare(
      "SELECT id, session_id, role, content FROM tutor_messages WHERE session_id = ? ORDER BY id"
    )
    .all(sessionId) as TutorMessageRow[];
}

export function addTutorMessage(
  db: Database.Database,
  sessionId: number,
  role: "user" | "assistant",
  content: string
): TutorMessageRow {
  const info = db
    .prepare(
      "INSERT INTO tutor_messages (session_id, role, content) VALUES (?, ?, ?)"
    )
    .run(sessionId, role, content);
  return db
    .prepare(
      "SELECT id, session_id, role, content FROM tutor_messages WHERE id = ?"
    )
    .get(info.lastInsertRowid) as TutorMessageRow;
}
