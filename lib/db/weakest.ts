import type Database from "better-sqlite3";

export interface WeakPattern {
  id: number;
  name: string;
  slug: string;
}

export function weakestPattern(db: Database.Database): WeakPattern | null {
  const reviewed = db
    .prepare(
      `SELECT pa.id, pa.name, pa.slug
         FROM reviews r JOIN patterns pa ON pa.id = r.item_id
        WHERE r.item_type = 'pattern'
        ORDER BY r.ease ASC, r.due_date ASC
        LIMIT 1`
    )
    .get() as WeakPattern | undefined;
  if (reviewed) return reviewed;

  const fallback = db
    .prepare("SELECT id, name, slug FROM patterns ORDER BY ordering, name LIMIT 1")
    .get() as WeakPattern | undefined;
  return fallback ?? null;
}
