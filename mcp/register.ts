import { z } from "zod";
import type Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  studyStats,
  weakestPatterns,
  dueForReview,
  recentActivity,
  getPattern,
  listNotes,
  listProblemsTool,
} from "@/mcp/studyData";
import { patternsWithReview } from "@/mcp/queries";
import { STUDY_SESSION_PROMPT } from "@/mcp/persona";

export interface StudyContext {
  openDb: () => Database.Database;
  today: () => string;
}

function run(produce: () => unknown): CallToolResult {
  try {
    return { content: [{ type: "text", text: JSON.stringify(produce(), null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}

export function registerAll(server: McpServer, ctx: StudyContext): void {
  server.registerTool(
    "study_stats",
    {
      description:
        "Overview of the learner's progress: problems solved (and by difficulty), total attempts, current streak, items due for review, and patterns started.",
      inputSchema: {},
    },
    async () => run(() => studyStats(ctx.openDb(), ctx.today()))
  );

  server.registerTool(
    "weakest_patterns",
    {
      description:
        "Patterns ranked by weakest spaced-repetition retention (lowest ease first, then unreviewed patterns). Use to decide what to shore up.",
      inputSchema: { limit: z.number().int().positive().max(50).optional() },
    },
    async ({ limit }) => run(() => weakestPatterns(ctx.openDb(), limit ?? 5))
  );

  server.registerTool(
    "due_for_review",
    {
      description:
        "Problems and patterns whose spaced-repetition review is due on or before today.",
      inputSchema: {},
    },
    async () => run(() => dueForReview(ctx.openDb(), ctx.today()))
  );

  server.registerTool(
    "recent_activity",
    {
      description:
        "The learner's most recent practice attempts (problem, outcome, self-rating, time, date).",
      inputSchema: { limit: z.number().int().positive().max(100).optional() },
    },
    async ({ limit }) => run(() => recentActivity(ctx.openDb(), limit ?? 20))
  );

  server.registerTool(
    "list_patterns",
    {
      description:
        "All study patterns with status and spaced-repetition state (ease, interval, due date).",
      inputSchema: {},
    },
    async () => run(() => patternsWithReview(ctx.openDb()))
  );

  server.registerTool(
    "get_pattern",
    {
      description:
        "Full detail for one pattern by name or slug: its study material, the learner's notes, and the problems mapped to it. Use to teach or quiz on a pattern.",
      inputSchema: { pattern: z.string() },
    },
    async ({ pattern }) => run(() => getPattern(ctx.openDb(), pattern))
  );

  server.registerTool(
    "list_notes",
    {
      description:
        "The learner's notes. Optionally filter to a single pattern by name or slug.",
      inputSchema: { pattern: z.string().optional() },
    },
    async ({ pattern }) => run(() => listNotes(ctx.openDb(), pattern))
  );

  server.registerTool(
    "list_problems",
    {
      description:
        "The problem board, filterable by keyword (q), difficulty, status, pattern (patternSlug), or source. Includes the learner's latest attempt per problem.",
      inputSchema: {
        q: z.string().optional(),
        difficulty: z.string().optional(),
        status: z.string().optional(),
        patternSlug: z.string().optional(),
        source: z.string().optional(),
      },
    },
    async (args) => run(() => listProblemsTool(ctx.openDb(), args))
  );

  server.registerPrompt(
    "study_session",
    {
      description:
        "Start a grounded DSA study session — Claude acts as a Socratic tutor using the DSA Trainer tools.",
    },
    async () => ({
      messages: [
        { role: "user", content: { type: "text", text: STUDY_SESSION_PROMPT } },
      ],
    })
  );
}
