import type Database from "better-sqlite3";

export interface ProblemFilters {
  q?: string;
  difficulty?: string;
  status?: string;
  patternSlug?: string;
  source?: string;
}

export interface ProblemListRow {
  id: number;
  title: string;
  lc_url: string | null;
  difficulty: string;
  status: string;
  patterns: string | null;
  last_attempt_date: string | null;
  last_outcome: string | null;
}

export function listProblems(
  db: Database.Database,
  filters: ProblemFilters
): ProblemListRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    where.push("p.title LIKE '%' || ? || '%'");
    params.push(filters.q);
  }
  if (filters.difficulty) {
    where.push("p.difficulty = ?");
    params.push(filters.difficulty);
  }
  if (filters.status) {
    where.push("p.status = ?");
    params.push(filters.status);
  }
  if (filters.patternSlug) {
    where.push(
      `EXISTS (SELECT 1 FROM problem_patterns pp JOIN patterns pa ON pa.id = pp.pattern_id
               WHERE pp.problem_id = p.id AND pa.slug = ?)`
    );
    params.push(filters.patternSlug);
  }
  if (filters.source) {
    where.push(
      `EXISTS (SELECT 1 FROM problem_sources ps JOIN sources s ON s.id = ps.source_id
               WHERE ps.problem_id = p.id AND s.name = ?)`
    );
    params.push(filters.source);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT p.id, p.title, p.lc_url, p.difficulty, p.status,
      (SELECT GROUP_CONCAT(pa.name, ', ')
         FROM problem_patterns pp JOIN patterns pa ON pa.id = pp.pattern_id
        WHERE pp.problem_id = p.id) AS patterns,
      (SELECT a.date FROM attempts a WHERE a.problem_id = p.id ORDER BY a.id DESC LIMIT 1) AS last_attempt_date,
      (SELECT a.outcome FROM attempts a WHERE a.problem_id = p.id ORDER BY a.id DESC LIMIT 1) AS last_outcome
    FROM problems p
    ${whereSql}
    ORDER BY p.title`;

  return db.prepare(sql).all(...params) as ProblemListRow[];
}
