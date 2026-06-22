import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function runMigrations(
  db: Database.Database,
  migrationsDir: string
): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`
  );

  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const justApplied: string[] = [];
  const record = db.prepare("INSERT INTO _migrations (name) VALUES (?)");

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      record.run(file);
    });
    tx();
    justApplied.push(file);
  }

  return justApplied;
}
