import type Database from "better-sqlite3";

export interface SourceRow {
  id: number;
  name: string;
}

export function listSources(db: Database.Database): SourceRow[] {
  return db
    .prepare("SELECT id, name FROM sources ORDER BY name")
    .all() as SourceRow[];
}
