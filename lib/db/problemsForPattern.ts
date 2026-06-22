import type Database from "better-sqlite3";

export interface ProblemRow {
  id: number;
  title: string;
  lc_url: string | null;
  difficulty: string;
  status: string;
}

export function listProblemsForPattern(
  db: Database.Database,
  patternId: number
): ProblemRow[] {
  return db
    .prepare(
      `SELECT p.id, p.title, p.lc_url, p.difficulty, p.status
       FROM problems p
       JOIN problem_patterns pp ON pp.problem_id = p.id
       WHERE pp.pattern_id = ?
       ORDER BY p.title`
    )
    .all(patternId) as ProblemRow[];
}
