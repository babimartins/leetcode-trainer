import type Database from "better-sqlite3";
import { solvedCount, currentStreak, dueCount, patternsProgress } from "@/lib/db/stats";
import { solvedByDifficulty, totalAttempts, type DifficultyCount } from "@/lib/db/statsPage";
import { getDueItems, type DueItem } from "@/lib/db/reviews";
import {
  listRecentAttempts,
  patternsWithReview,
  type RecentAttempt,
  type PatternWithReview,
} from "@/mcp/queries";

export interface StudyStats {
  solved: number;
  solvedByDifficulty: DifficultyCount[];
  totalAttempts: number;
  streak: number;
  due: number;
  patternsStarted: number;
  patternsTotal: number;
}

export function studyStats(db: Database.Database, today: string): StudyStats {
  const p = patternsProgress(db);
  return {
    solved: solvedCount(db),
    solvedByDifficulty: solvedByDifficulty(db),
    totalAttempts: totalAttempts(db),
    streak: currentStreak(db, today),
    due: dueCount(db, today),
    patternsStarted: p.started,
    patternsTotal: p.total,
  };
}

export function weakestPatterns(
  db: Database.Database,
  limit = 5
): PatternWithReview[] {
  const rows = [...patternsWithReview(db)];
  rows.sort((a, b) => {
    const an = a.ease == null;
    const bn = b.ease == null;
    if (an !== bn) return an ? 1 : -1; // reviewed (known-weak) before unreviewed
    if (!an && !bn && a.ease !== b.ease) return (a.ease as number) - (b.ease as number);
    return (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99");
  });
  return rows.slice(0, limit);
}

export function dueForReview(db: Database.Database, today: string): DueItem[] {
  return getDueItems(db, today);
}

export function recentActivity(
  db: Database.Database,
  limit = 20
): RecentAttempt[] {
  return listRecentAttempts(db, limit);
}
