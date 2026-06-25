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
import { listPatterns, getPatternBySlug, type PatternRow } from "@/lib/db/patterns";
import { listNotesForPattern, type NoteRow } from "@/lib/db/notes";
import { listProblemsForPattern, type ProblemRow } from "@/lib/db/problemsForPattern";
import { listProblems, type ProblemFilters, type ProblemListRow } from "@/lib/db/problemsList";
import { listAllNotes, type NoteWithPattern } from "@/mcp/queries";
import { loadPatternContent } from "@/lib/content/loadPattern";
import { CONTENT_PATTERNS_DIR } from "@/mcp/db";

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

function resolvePattern(db: Database.Database, query: string): PatternRow | null {
  const bySlug = getPatternBySlug(db, query);
  if (bySlug) return bySlug;
  const lower = query.trim().toLowerCase();
  return (
    listPatterns(db).find(
      (p) => p.name.toLowerCase() === lower || p.slug.toLowerCase() === lower
    ) ?? null
  );
}

export interface PatternDetail {
  pattern: PatternRow;
  material: string | null;
  notes: NoteRow[];
  problems: ProblemRow[];
}

export function getPattern(
  db: Database.Database,
  query: string,
  contentDir: string = CONTENT_PATTERNS_DIR
): PatternDetail {
  const pattern = resolvePattern(db, query);
  if (!pattern) {
    throw new Error(
      `No pattern named "${query}". Use the list_patterns tool to see available patterns.`
    );
  }
  return {
    pattern,
    material: loadPatternContent(pattern.slug, contentDir),
    notes: listNotesForPattern(db, pattern.id),
    problems: listProblemsForPattern(db, pattern.id),
  };
}

export function listNotes(
  db: Database.Database,
  patternSlug?: string
): NoteRow[] | NoteWithPattern[] {
  if (patternSlug && patternSlug.trim()) {
    const pattern = resolvePattern(db, patternSlug);
    if (!pattern) {
      throw new Error(
        `No pattern named "${patternSlug}". Use the list_patterns tool to see available patterns.`
      );
    }
    return listNotesForPattern(db, pattern.id);
  }
  return listAllNotes(db);
}

export function listProblemsTool(
  db: Database.Database,
  filters: ProblemFilters
): ProblemListRow[] {
  return listProblems(db, filters);
}
