import type Database from "better-sqlite3";

export function getAppState(
  db: Database.Database,
  key: string
): string | null {
  const row = db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setAppState(
  db: Database.Database,
  key: string,
  value: string
): void {
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
