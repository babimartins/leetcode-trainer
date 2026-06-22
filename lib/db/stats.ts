import type Database from "better-sqlite3";
import { addDays } from "@/lib/srs/dates";

export function dueCount(db: Database.Database, today: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM reviews WHERE due_date IS NOT NULL AND due_date <= ?"
    )
    .get(today) as { c: number };
  return row.c;
}

export function solvedCount(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM problems WHERE status = 'solved'")
    .get() as { c: number };
  return row.c;
}

export function patternsProgress(db: Database.Database): {
  started: number;
  total: number;
} {
  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM patterns").get() as { c: number }
  ).c;
  const started = (
    db
      .prepare("SELECT COUNT(*) AS c FROM patterns WHERE status <> 'not_started'")
      .get() as { c: number }
  ).c;
  return { started, total };
}

export function currentStreak(db: Database.Database, today: string): number {
  const days = new Set(
    (
      db
        .prepare("SELECT DISTINCT date(date) AS d FROM attempts")
        .all() as { d: string }[]
    ).map((r) => r.d)
  );
  let streak = 0;
  let cursor = today;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface ResumeProblem {
  id: number;
  title: string;
  lc_url: string | null;
}

export function lastAttemptedProblem(
  db: Database.Database
): ResumeProblem | null {
  const row = db
    .prepare(
      `SELECT p.id, p.title, p.lc_url
         FROM attempts a JOIN problems p ON p.id = a.problem_id
        ORDER BY a.id DESC LIMIT 1`
    )
    .get() as ResumeProblem | undefined;
  return row ?? null;
}
