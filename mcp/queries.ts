import type Database from "better-sqlite3";

export interface RecentAttempt {
  id: number;
  problem_id: number;
  title: string;
  outcome: string;
  rating: string | null;
  minutes: number | null;
  used_hint: number;
  reflection: string | null;
  date: string;
}

export function listRecentAttempts(
  db: Database.Database,
  limit = 20
): RecentAttempt[] {
  return db
    .prepare(
      `SELECT a.id, a.problem_id, p.title AS title, a.outcome, a.rating,
              a.minutes, a.used_hint, a.reflection, a.date
         FROM attempts a JOIN problems p ON p.id = a.problem_id
        ORDER BY a.id DESC LIMIT ?`
    )
    .all(limit) as RecentAttempt[];
}

export interface NoteWithPattern {
  id: number;
  pattern_id: number;
  pattern_name: string;
  pattern_slug: string;
  section_key: string;
  body: string;
}

export function listAllNotes(db: Database.Database): NoteWithPattern[] {
  return db
    .prepare(
      `SELECT n.id, n.pattern_id, pa.name AS pattern_name, pa.slug AS pattern_slug,
              n.section_key, n.body
         FROM notes n JOIN patterns pa ON pa.id = n.pattern_id
        ORDER BY pa.ordering, pa.name, n.id`
    )
    .all() as NoteWithPattern[];
}

export interface PatternWithReview {
  id: number;
  name: string;
  slug: string;
  status: string;
  ordering: number;
  ease: number | null;
  interval_days: number | null;
  due_date: string | null;
}

export function patternsWithReview(db: Database.Database): PatternWithReview[] {
  return db
    .prepare(
      `SELECT pa.id, pa.name, pa.slug, pa.status, pa.ordering,
              r.ease AS ease, r.interval_days AS interval_days, r.due_date AS due_date
         FROM patterns pa
         LEFT JOIN reviews r ON r.item_type = 'pattern' AND r.item_id = pa.id
        ORDER BY pa.ordering, pa.name`
    )
    .all() as PatternWithReview[];
}
