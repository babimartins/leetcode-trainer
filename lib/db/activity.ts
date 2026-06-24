import type Database from "better-sqlite3";

export function attemptCountsByDay(
  db: Database.Database,
  sinceDay: string
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT date(date) AS day, COUNT(*) AS count
         FROM attempts
        WHERE date(date) >= ?
        GROUP BY day`
    )
    .all(sinceDay) as { day: string; count: number }[];
  const map: Record<string, number> = {};
  for (const r of rows) map[r.day] = r.count;
  return map;
}
