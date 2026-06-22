import type Database from "better-sqlite3";

export type Outcome = "solved" | "partial" | "failed";
export type Rating = "hard" | "ok" | "easy";

export interface AttemptRow {
  id: number;
  problem_id: number;
  date: string;
  outcome: string;
  rating: string | null;
  minutes: number | null;
  used_hint: number;
  reflection: string | null;
}

export interface LogAttemptInput {
  problemId: number;
  outcome: Outcome;
  rating?: Rating | null;
  minutes?: number | null;
  usedHint?: boolean;
  reflection?: string | null;
}

export function statusForOutcome(outcome: Outcome): string {
  return outcome === "solved" ? "solved" : "solving";
}

export function logAttempt(
  db: Database.Database,
  input: LogAttemptInput
): AttemptRow {
  const tx = db.transaction((): AttemptRow => {
    const info = db
      .prepare(
        `INSERT INTO attempts (problem_id, outcome, rating, minutes, used_hint, reflection)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.problemId,
        input.outcome,
        input.rating ?? null,
        input.minutes ?? null,
        input.usedHint ? 1 : 0,
        input.reflection ?? null
      );
    db.prepare("UPDATE problems SET status = ? WHERE id = ?").run(
      statusForOutcome(input.outcome),
      input.problemId
    );
    return db
      .prepare(
        "SELECT id, problem_id, date, outcome, rating, minutes, used_hint, reflection FROM attempts WHERE id = ?"
      )
      .get(info.lastInsertRowid) as AttemptRow;
  });
  return tx();
}

export function listAttemptsForProblem(
  db: Database.Database,
  problemId: number
): AttemptRow[] {
  return db
    .prepare(
      `SELECT id, problem_id, date, outcome, rating, minutes, used_hint, reflection
       FROM attempts WHERE problem_id = ? ORDER BY id DESC`
    )
    .all(problemId) as AttemptRow[];
}
