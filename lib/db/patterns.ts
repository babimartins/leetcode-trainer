import type Database from "better-sqlite3";

export interface PatternRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  ordering: number;
}

export function listPatterns(db: Database.Database): PatternRow[] {
  return db
    .prepare(
      "SELECT id, name, slug, status, ordering FROM patterns ORDER BY ordering, name"
    )
    .all() as PatternRow[];
}

export function getPatternBySlug(
  db: Database.Database,
  slug: string
): PatternRow | null {
  const row = db
    .prepare(
      "SELECT id, name, slug, status, ordering FROM patterns WHERE slug = ?"
    )
    .get(slug) as PatternRow | undefined;
  return row ?? null;
}
