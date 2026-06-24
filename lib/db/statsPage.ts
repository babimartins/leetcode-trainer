import type Database from "better-sqlite3";

export interface DifficultyCount {
  difficulty: string;
  solved: number;
}

export function solvedByDifficulty(db: Database.Database): DifficultyCount[] {
  return db
    .prepare(
      `SELECT difficulty, COUNT(*) AS solved
         FROM problems WHERE status = 'solved'
        GROUP BY difficulty ORDER BY difficulty`
    )
    .all() as DifficultyCount[];
}

export function totalAttempts(db: Database.Database): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM attempts").get() as { c: number }
  ).c;
}

export interface PatternMastery {
  name: string;
  slug: string;
  status: string;
  ease: number | null;
  interval_days: number | null;
}

export function patternMastery(db: Database.Database): PatternMastery[] {
  return db
    .prepare(
      `SELECT pa.name, pa.slug, pa.status, r.ease AS ease, r.interval_days AS interval_days
         FROM patterns pa
         LEFT JOIN reviews r ON r.item_type = 'pattern' AND r.item_id = pa.id
        ORDER BY pa.ordering, pa.name`
    )
    .all() as PatternMastery[];
}
