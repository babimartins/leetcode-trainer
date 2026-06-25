# DSA Trainer — Study Connector (MCP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local, read-only Model Context Protocol (MCP) server that exposes the DSA Trainer study database to the Claude desktop app, so Claude can answer questions about Barbara's lists and topics grounded in her live data.

**Architecture:** A standalone Node/TypeScript process in a new `mcp/` folder, run via `tsx`, talking MCP over stdio. It opens `data/dsa.sqlite` read-only and reuses the app's existing `lib/db/*` query helpers. Pure "tool functions" return JSON data and are unit-tested against seeded databases; a thin registration layer wires them into the MCP SDK (8 tools + 1 persona prompt); a small entry file connects the stdio transport.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (v1.x) + `zod` (v3), `better-sqlite3` (read-only), `tsx`, Vitest.

## Global Constraints

- **Read-only.** The DB is opened with `{ readonly: true, fileMustExist: true }`. No tool may write. Writes are impossible by construction.
- **Local stdio only.** No network listener, no port, no auth. Transport is `StdioServerTransport`.
- **Never write to stdout** from the server — stdout carries the JSON-RPC protocol. All logging uses `console.error` (stderr).
- **Reuse, don't duplicate.** Compose the app's existing `lib/db/*` and `lib/content/*` helpers. Only add genuinely new read queries (in `mcp/queries.ts`).
- **Imports:** use the `@/` path alias for in-repo modules (`@/lib/...`, `@/mcp/...`) — `tsx` and Vitest both resolve it. Import the MCP SDK with its required `.js` suffixes (`@modelcontextprotocol/sdk/server/mcp.js`, etc.). Import zod as `import { z } from "zod"`.
- **DB path:** resolved from `process.env.DSA_DB_PATH`, defaulting to `<repo>/data/dsa.sqlite` (computed from the module's own location, not `process.cwd()`).
- **Exact names — 8 tools + 1 prompt:** `study_stats`, `weakest_patterns`, `due_for_review`, `recent_activity`, `list_patterns`, `get_pattern`, `list_notes`, `list_problems`; prompt `study_session`.
- **No face emojis** anywhere (including the persona prompt text).
- New deps installed exactly as `@modelcontextprotocol/sdk@^1 zod@^3`.

---

## File Structure

- `mcp/db.ts` — repo-root/path constants + `openReadOnlyDb()`.
- `mcp/queries.ts` — new read queries not in `lib/db` (`listRecentAttempts`, `listAllNotes`, `patternsWithReview`).
- `mcp/studyData.ts` — the 8 pure tool functions composing existing helpers + queries.
- `mcp/persona.ts` — the `study_session` prompt text.
- `mcp/register.ts` — `registerAll(server, ctx)` wires the 8 tools + the prompt into an `McpServer`.
- `mcp/server.ts` — entry point: builds the server, connects stdio.
- `mcp/README.md` — Claude Desktop setup + usage docs.
- `mcp/*.test.ts` — Vitest tests (`db`, `queries`, `studyData`, `register`).
- Modify `package.json` (deps + `mcp` script) and the root `README.md` (a short "Study connector" section).

---

## Task 1: Dependencies + read-only DB module

**Files:**
- Modify: `package.json` (add deps + `mcp` script)
- Create: `mcp/db.ts`
- Test: `mcp/db.test.ts`

**Interfaces:**
- Produces:
  - `REPO_ROOT: string`, `DEFAULT_DB_PATH: string`, `CONTENT_PATTERNS_DIR: string`
  - `openReadOnlyDb(dbPath?: string): Database.Database` — opens the SQLite file read-only; throws a friendly `Error` (mentioning `npm run migrate`) if the file is missing.

- [ ] **Step 1: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk@^1 zod@^3
```

- [ ] **Step 2: Add the `mcp` script to package.json**

In `package.json`, add to `"scripts"` (after `"seed"`):
```json
    "mcp": "tsx mcp/server.ts"
```

- [ ] **Step 3: Write the failing test**

`mcp/db.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openReadOnlyDb } from "@/mcp/db";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-mcp-"));
  dbPath = path.join(dir, "dsa.sqlite");
  const w = new Database(dbPath);
  w.exec("CREATE TABLE t (x INTEGER); INSERT INTO t (x) VALUES (42);");
  w.close();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("openReadOnlyDb", () => {
  it("opens an existing db read-only and reads data", () => {
    const ro = openReadOnlyDb(dbPath);
    expect((ro.prepare("SELECT x FROM t").get() as { x: number }).x).toBe(42);
    ro.close();
  });

  it("rejects writes", () => {
    const ro = openReadOnlyDb(dbPath);
    expect(() => ro.prepare("INSERT INTO t (x) VALUES (1)").run()).toThrow(/readonly/i);
    ro.close();
  });

  it("throws a friendly error when the db file is missing", () => {
    expect(() => openReadOnlyDb(path.join(dir, "nope.sqlite"))).toThrow(/npm run migrate/);
  });
});
```

- [ ] **Step 4: Run the test — confirm it fails**

Run: `npx vitest run mcp/db.test.ts`
Expected: FAIL — cannot find `@/mcp/db`.

- [ ] **Step 5: Implement `mcp/db.ts`**

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");
export const DEFAULT_DB_PATH = path.join(REPO_ROOT, "data", "dsa.sqlite");
export const CONTENT_PATTERNS_DIR = path.join(REPO_ROOT, "content", "patterns");

export function openReadOnlyDb(
  dbPath: string = process.env.DSA_DB_PATH || DEFAULT_DB_PATH
): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Study database not found at ${dbPath}. Run \`npm run migrate\` (and \`npm run seed\`) in the DSA Trainer app first.`
    );
  }
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}
```

- [ ] **Step 6: Run the test — confirm it passes**

Run: `npx vitest run mcp/db.test.ts`
Expected: 3 PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json mcp/db.ts mcp/db.test.ts
git commit -m "feat(mcp): add deps and read-only db module"
```

---

## Task 2: New read queries

**Files:**
- Create: `mcp/queries.ts`
- Test: `mcp/queries.test.ts`

**Interfaces:**
- Produces:
  - `RecentAttempt` + `listRecentAttempts(db, limit?): RecentAttempt[]`
  - `NoteWithPattern` + `listAllNotes(db): NoteWithPattern[]`
  - `PatternWithReview` + `patternsWithReview(db): PatternWithReview[]`

- [ ] **Step 1: Write the failing tests**

`mcp/queries.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listRecentAttempts, listAllNotes, patternsWithReview } from "@/mcp/queries";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT, minutes INTEGER, used_hint INTEGER DEFAULT 0, reflection TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, pattern_id INTEGER, section_key TEXT, body TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating,minutes,used_hint,reflection) VALUES (1,1,'2026-06-24 10:00:00','solved','ok',12,0,'felt good')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (2,1,'2026-06-25 09:00:00','partial','hard')").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (1,1,'overview','expand and contract the window')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',1,1.8,3,'2026-06-28','2026-06-25')").run();
});

describe("listRecentAttempts", () => {
  it("returns attempts newest-first with the problem title", () => {
    const rows = listRecentAttempts(db, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(2);
    expect(rows[0].title).toBe("Two Sum");
    expect(rows[0].outcome).toBe("partial");
    expect(rows[1].rating).toBe("ok");
  });
});

describe("listAllNotes", () => {
  it("returns notes with their pattern name and slug", () => {
    const rows = listAllNotes(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].pattern_name).toBe("Sliding Window");
    expect(rows[0].pattern_slug).toBe("sliding-window");
    expect(rows[0].body).toBe("expand and contract the window");
  });
});

describe("patternsWithReview", () => {
  it("joins each pattern to its pattern-review state (null when unreviewed)", () => {
    const rows = patternsWithReview(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ slug: "sliding-window", ease: 1.8, interval_days: 3, due_date: "2026-06-28" });
    expect(rows[1]).toMatchObject({ slug: "binary-search", ease: null, interval_days: null, due_date: null });
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npx vitest run mcp/queries.test.ts`
Expected: FAIL — cannot find `@/mcp/queries`.

- [ ] **Step 3: Implement `mcp/queries.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npx vitest run mcp/queries.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp/queries.ts mcp/queries.test.ts
git commit -m "feat(mcp): add recent-attempts, all-notes, patterns-with-review queries"
```

---

## Task 3: Study data — state tools

**Files:**
- Create: `mcp/studyData.ts`
- Test: `mcp/studyData.state.test.ts`

**Interfaces:**
- Consumes: `solvedCount`/`currentStreak`/`dueCount`/`patternsProgress` (`@/lib/db/stats`), `solvedByDifficulty`/`totalAttempts` (`@/lib/db/statsPage`), `getDueItems`/`DueItem` (`@/lib/db/reviews`), `listRecentAttempts`/`RecentAttempt`/`patternsWithReview`/`PatternWithReview` (`@/mcp/queries`).
- Produces:
  - `StudyStats` + `studyStats(db, today): StudyStats`
  - `weakestPatterns(db, limit?): PatternWithReview[]`
  - `dueForReview(db, today): DueItem[]`
  - `recentActivity(db, limit?): RecentAttempt[]`

- [ ] **Step 1: Write the failing tests**

`mcp/studyData.state.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { studyStats, weakestPatterns, dueForReview, recentActivity } from "@/mcp/studyData";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT, minutes INTEGER, used_hint INTEGER DEFAULT 0, reflection TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','learning',2)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (3,'Graphs','graphs','not_started',3)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (2,'Koko','Medium','solving')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (1,1,'2026-06-24 10:00:00','solved','ok')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome,rating) VALUES (2,2,'2026-06-25 09:00:00','partial','hard')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',1,1.8,3,'2026-06-28','2026-06-25')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',2,2.5,8,'2026-07-03','2026-06-25')").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('problem',1,2.5,1,'2026-06-20','2026-06-19')").run();
});

describe("studyStats", () => {
  it("summarizes progress", () => {
    const s = studyStats(db, "2026-06-25");
    expect(s.solved).toBe(1);
    expect(s.totalAttempts).toBe(2);
    expect(s.patternsTotal).toBe(3);
    expect(s.patternsStarted).toBe(2);
    expect(s.streak).toBe(2); // attempts on 06-24 and 06-25
    expect(s.due).toBe(1); // problem review due 06-20 <= today
    expect(s.solvedByDifficulty).toEqual([{ difficulty: "Easy", solved: 1 }]);
  });
});

describe("weakestPatterns", () => {
  it("ranks reviewed patterns by lowest ease, then unreviewed last", () => {
    const rows = weakestPatterns(db, 5);
    expect(rows.map((r) => r.slug)).toEqual(["sliding-window", "binary-search", "graphs"]);
  });
  it("respects the limit", () => {
    expect(weakestPatterns(db, 1).map((r) => r.slug)).toEqual(["sliding-window"]);
  });
});

describe("dueForReview", () => {
  it("returns items due on or before today", () => {
    const due = dueForReview(db, "2026-06-25");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ item_type: "problem", item_id: 1 });
  });
});

describe("recentActivity", () => {
  it("returns recent attempts newest-first", () => {
    const rows = recentActivity(db, 10);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npx vitest run mcp/studyData.state.test.ts`
Expected: FAIL — cannot find `@/mcp/studyData`.

- [ ] **Step 3: Implement `mcp/studyData.ts` (state tools)**

```ts
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
```

Note: `DifficultyCount` is exported from `@/lib/db/statsPage`. If the implementer finds it is not exported there, add `export` to its `interface DifficultyCount` declaration in `lib/db/statsPage.ts` (it is the return element type of `solvedByDifficulty`).

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npx vitest run mcp/studyData.state.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp/studyData.ts mcp/studyData.state.test.ts
git commit -m "feat(mcp): add state tools (stats, weakest, due, recent)"
```

---

## Task 4: Study data — topic & list tools

**Files:**
- Modify: `mcp/studyData.ts` (append)
- Test: `mcp/studyData.topics.test.ts`

**Interfaces:**
- Consumes: `listPatterns`/`getPatternBySlug`/`PatternRow` (`@/lib/db/patterns`), `listNotesForPattern`/`NoteRow` (`@/lib/db/notes`), `listProblemsForPattern`/`ProblemRow` (`@/lib/db/problemsForPattern`), `listProblems`/`ProblemFilters`/`ProblemListRow` (`@/lib/db/problemsList`), `listAllNotes`/`NoteWithPattern` (`@/mcp/queries`), `loadPatternContent` (`@/lib/content/loadPattern`), `CONTENT_PATTERNS_DIR` (`@/mcp/db`).
- Produces:
  - `PatternDetail` + `getPattern(db, query, contentDir?): PatternDetail` (throws on unknown pattern)
  - `listNotes(db, patternSlug?): NoteRow[] | NoteWithPattern[]`
  - `listProblemsTool(db, filters): ProblemListRow[]`

- [ ] **Step 1: Write the failing tests**

`mcp/studyData.topics.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPattern, listNotes, listProblemsTool } from "@/mcp/studyData";

let db: Database.Database;
let contentDir: string;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE problem_patterns (problem_id INTEGER, pattern_id INTEGER, PRIMARY KEY (problem_id, pattern_id));
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, pattern_id INTEGER, section_key TEXT, body TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Longest Substring','Medium','solved')").run();
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (1,1)").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (1,1,'overview','two pointers, grow and shrink')").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (2,2,'overview','halve the search space')").run();

  contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-content-"));
  fs.writeFileSync(path.join(contentDir, "sliding-window.md"), "# Sliding Window\nGrow and shrink a window.");
});
afterEach(() => fs.rmSync(contentDir, { recursive: true, force: true }));

describe("getPattern", () => {
  it("returns material, notes, and mapped problems for a slug", () => {
    const d = getPattern(db, "sliding-window", contentDir);
    expect(d.pattern.name).toBe("Sliding Window");
    expect(d.material).toContain("Grow and shrink");
    expect(d.notes).toHaveLength(1);
    expect(d.problems.map((p) => p.title)).toEqual(["Longest Substring"]);
  });
  it("resolves by display name too", () => {
    expect(getPattern(db, "Sliding Window", contentDir).pattern.slug).toBe("sliding-window");
  });
  it("returns null material when no file exists", () => {
    expect(getPattern(db, "binary-search", contentDir).material).toBeNull();
  });
  it("throws a helpful error for an unknown pattern", () => {
    expect(() => getPattern(db, "nope", contentDir)).toThrow(/list_patterns/);
  });
});

describe("listNotes", () => {
  it("returns all notes when no pattern is given", () => {
    expect(listNotes(db)).toHaveLength(2);
  });
  it("filters to one pattern", () => {
    const notes = listNotes(db, "sliding-window");
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("grow and shrink");
  });
});

describe("listProblemsTool", () => {
  it("filters by status", () => {
    const rows = listProblemsTool(db, { status: "solved" });
    expect(rows.map((r) => r.title)).toEqual(["Longest Substring"]);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npx vitest run mcp/studyData.topics.test.ts`
Expected: FAIL — `getPattern` / `listNotes` / `listProblemsTool` not exported.

- [ ] **Step 3: Append to `mcp/studyData.ts`**

```ts
import { listPatterns, getPatternBySlug, type PatternRow } from "@/lib/db/patterns";
import { listNotesForPattern, type NoteRow } from "@/lib/db/notes";
import { listProblemsForPattern, type ProblemRow } from "@/lib/db/problemsForPattern";
import { listProblems, type ProblemFilters, type ProblemListRow } from "@/lib/db/problemsList";
import { listAllNotes, type NoteWithPattern } from "@/mcp/queries";
import { loadPatternContent } from "@/lib/content/loadPattern";
import { CONTENT_PATTERNS_DIR } from "@/mcp/db";

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
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npx vitest run mcp/studyData.topics.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp/studyData.ts mcp/studyData.topics.test.ts
git commit -m "feat(mcp): add topic and list tools (get_pattern, notes, problems)"
```

---

## Task 5: Persona + registration wiring

**Files:**
- Create: `mcp/persona.ts`, `mcp/register.ts`
- Test: `mcp/register.test.ts`

**Interfaces:**
- Consumes: the 7 tool functions from `@/mcp/studyData`, `patternsWithReview` from `@/mcp/queries`, `McpServer` (`@modelcontextprotocol/sdk/server/mcp.js`), `z` (`zod`).
- Produces:
  - `STUDY_SESSION_PROMPT: string` (`mcp/persona.ts`)
  - `StudyContext` (`{ openDb: () => Database.Database; today: () => string }`) and `registerAll(server: McpServer, ctx: StudyContext): void` (`mcp/register.ts`)

- [ ] **Step 1: Write the failing test**

`mcp/register.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAll } from "@/mcp/register";

let db: Database.Database;
let server: McpServer;
let client: Client;

beforeEach(async () => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (1,'Sliding Window','sliding-window',1)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome) VALUES (1,1,'2026-06-25 09:00:00','solved')").run();

  server = new McpServer({ name: "dsa-trainer-test", version: "0" });
  registerAll(server, { openDb: () => db, today: () => "2026-06-25" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await server.close();
  db.close();
});

it("registers exactly the eight tools", async () => {
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    "due_for_review",
    "get_pattern",
    "list_notes",
    "list_patterns",
    "list_problems",
    "recent_activity",
    "study_stats",
    "weakest_patterns",
  ]);
});

it("registers the study_session prompt", async () => {
  const { prompts } = await client.listPrompts();
  expect(prompts.map((p) => p.name)).toContain("study_session");
});

it("study_stats returns JSON data", async () => {
  const res = await client.callTool({ name: "study_stats", arguments: {} });
  expect(res.isError).toBeFalsy();
  const text = (res.content as Array<{ text: string }>)[0].text;
  expect(JSON.parse(text)).toHaveProperty("solved", 1);
});

it("get_pattern on an unknown pattern returns an error result", async () => {
  const res = await client.callTool({ name: "get_pattern", arguments: { pattern: "nope" } });
  expect(res.isError).toBe(true);
  expect((res.content as Array<{ text: string }>)[0].text).toMatch(/list_patterns/);
});
```

- [ ] **Step 2: Run the test — confirm it fails**

Run: `npx vitest run mcp/register.test.ts`
Expected: FAIL — cannot find `@/mcp/register`.

- [ ] **Step 3: Implement `mcp/persona.ts`**

```ts
export const STUDY_SESSION_PROMPT = `You are my patient, Socratic computer-science tutor and study buddy, helping me prepare for coding interviews using my own DSA Trainer data.

Use the DSA Trainer tools to ground every answer in my actual data:
- Check study_stats, weakest_patterns, and due_for_review to know where I stand.
- Use list_patterns, then get_pattern (its study material, my notes, and the problems mapped to it) and list_notes to teach a topic from my own material.
- Use list_problems to answer questions about my lists (what is unsolved, by difficulty, by pattern, and so on).
- Use recent_activity to see what I have been working on lately.

Teaching style: prefer guiding questions and having me explain ideas back over lecturing. Correct me gently and point to the specific idea I missed. Keep replies concise; use plain text and short code snippets; do not use emoji. When you cite my data, make sure it came from a tool call rather than a guess.

Start by checking what I am weakest on or what is due, then ask me what I would like to work on.`;
```

- [ ] **Step 4: Implement `mcp/register.ts`**

```ts
import { z } from "zod";
import type Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

interface TextResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function run(produce: () => unknown): TextResult {
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
```

- [ ] **Step 5: Run the test — confirm it passes**

Run: `npx vitest run mcp/register.test.ts`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add mcp/persona.ts mcp/register.ts mcp/register.test.ts
git commit -m "feat(mcp): wire tools and study_session prompt into the server"
```

---

## Task 6: Server entry + full verification

**Files:**
- Create: `mcp/server.ts`

**Interfaces:**
- Consumes: `McpServer`/`StdioServerTransport` (SDK), `openReadOnlyDb` (`@/mcp/db`), `registerAll` (`@/mcp/register`), `todayIso` (`@/lib/srs/dates`).

- [ ] **Step 1: Implement `mcp/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type Database from "better-sqlite3";
import { openReadOnlyDb } from "@/mcp/db";
import { registerAll } from "@/mcp/register";
import { todayIso } from "@/lib/srs/dates";

// Lazily open one read-only connection, reused across calls. With WAL, a
// read-only connection sees the latest committed state on each query, so the
// answers stay live as the app writes. Re-tries if the file did not exist yet.
let cached: Database.Database | null = null;
function db(): Database.Database {
  if (!cached) cached = openReadOnlyDb();
  return cached;
}

const server = new McpServer({ name: "dsa-trainer", version: "0.1.0" });
registerAll(server, { openDb: db, today: () => todayIso() });

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the JSON-RPC channel.
  console.error("DSA Trainer MCP server running (stdio).");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the server boots without crashing**

Run:
```bash
( timeout 4 npx tsx mcp/server.ts < /dev/null > /tmp/mcp-stdout.log 2> /tmp/mcp-stderr.log; true ) && grep -q "running" /tmp/mcp-stderr.log && echo "BOOT OK" && test ! -s /tmp/mcp-stdout.log && echo "STDOUT CLEAN"
```
Expected: prints `BOOT OK` and `STDOUT CLEAN` (server starts, logs to stderr, writes nothing to stdout). (`tsx` must resolve `@/` via the repo `tsconfig.json`; run from the repo root.)

- [ ] **Step 3: Type-check the whole project**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all suites pass (prior app tests + the 4 new `mcp/*.test.ts` files).

- [ ] **Step 5: Commit**

```bash
git add mcp/server.ts
git commit -m "feat(mcp): add stdio server entry point"
```

---

## Task 7: Setup documentation

**Files:**
- Create: `mcp/README.md`
- Modify: `README.md` (add a short "Study connector (MCP)" section)

**Interfaces:** none (docs only).

- [ ] **Step 1: Write `mcp/README.md`**

```markdown
# DSA Trainer — Study Connector (MCP)

A local, **read-only** Model Context Protocol server that lets the **Claude
desktop app** read your live study database and answer questions about your
patterns, problems, weak areas, notes, attempts, and stats. It runs locally over
stdio, uses your Claude subscription (no API credits), and cannot modify anything.

## What Claude can do

Tools: `study_stats`, `weakest_patterns`, `due_for_review`, `recent_activity`,
`list_patterns`, `get_pattern`, `list_notes`, `list_problems`.
Prompt: `study_session` (starts a grounded Socratic tutoring session).

## Setup (one time)

1. Make sure the study database exists: from the repo root, run
   `npm run migrate` (and `npm run seed` for sample data) if you have not already.
2. Install the **Claude desktop app** and sign in.
3. Open Claude's config file:
   `~/Library/Application Support/Claude/claude_desktop_config.json`
   (create it if it does not exist).
4. Add the `dsa-trainer` server:

   ```json
   {
     "mcpServers": {
       "dsa-trainer": {
         "command": "npx",
         "args": ["tsx", "mcp/server.ts"],
         "cwd": "/Users/barbarad/Documents/LeetCode/dsa-trainer",
         "env": {
           "DSA_DB_PATH": "/Users/barbarad/Documents/LeetCode/dsa-trainer/data/dsa.sqlite"
         }
       }
     }
   }
   ```

5. Quit and reopen the Claude desktop app. "DSA Trainer" appears as a connector.

## Using it

- Pick the **`study_session`** prompt to start a tutoring session, or just ask
  questions like "what am I weakest on?", "what's unsolved in the sliding-window
  list?", or "explain binary search using my notes."
- It reads the database live, so anything you log in the app shows up on your next
  question. The DSA Trainer app does not need to be running.

## Troubleshooting

- **"Study database not found"** — run `npm run migrate` in the repo, and check the
  `DSA_DB_PATH` in the config points at `data/dsa.sqlite`.
- **Connector doesn't appear** — confirm the `cwd` is the repo root (so `tsx`
  finds `tsconfig.json`) and fully quit/reopen the Claude desktop app.
- It is read-only by design: Claude cannot change your data through it.
```

- [ ] **Step 2: Add a section to the root `README.md`**

Add this section to `README.md` immediately before the `## License` section:

```markdown
## Study connector (MCP)

A local, read-only Model Context Protocol server (in `mcp/`) lets the **Claude
desktop app** read your live study data and answer questions about your patterns,
problems, weak areas, notes, and stats — grounded in your own material, on your
Claude subscription (no API credits), with no ability to modify anything. See
[`mcp/README.md`](mcp/README.md) for the one-time Claude Desktop setup.
```

- [ ] **Step 3: Verify the docs render and links resolve**

Run: `test -f mcp/README.md && grep -q "Study connector (MCP)" README.md && echo "DOCS OK"`
Expected: prints `DOCS OK`.

- [ ] **Step 4: Commit**

```bash
git add mcp/README.md README.md
git commit -m "docs(mcp): add study-connector setup and usage docs"
```

---

## Definition of Done

- `mcp/server.ts` boots over stdio, writes nothing to stdout, and serves 8 read-only
  tools + the `study_session` prompt (verified by `mcp/register.test.ts` via an
  in-process client).
- All tools reuse the app's existing query helpers (plus three new read queries in
  `mcp/queries.ts`); the DB is opened read-only and writes are impossible.
- `npm test` passes (prior suites + `db`, `queries`, `studyData.state`,
  `studyData.topics`, `register`); `tsc --noEmit` is clean.
- `mcp/README.md` documents the Claude Desktop config; the root README points to it.
- Out of scope (future): write actions, a `.mcpb` one-click installer, a guarded
  generic `query` tool, and remote/hosted access for claude.ai web.

## Self-Review Notes

- **Spec coverage:** read-only connector ✓ (Task 1 + Global Constraints); 8 tools ✓
  (Tasks 3–4, registered in Task 5); persona prompt ✓ (Task 5); reuse of `lib/db`
  ✓ (Tasks 3–4); error handling — missing DB, read-only, unknown pattern, no
  material ✓ (Tasks 1, 4, 5); testing ✓ (every task); Claude Desktop setup ✓
  (Task 7); scope/phasing ✓ (Definition of Done).
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `RecentAttempt`/`NoteWithPattern`/`PatternWithReview`
  (Task 2) are consumed unchanged in Tasks 3–5; `StudyContext`
  (`openDb`/`today`) is defined in Task 5 and supplied identically in `server.ts`
  (Task 6); tool names match the Global Constraints list and the `register.test`
  assertion exactly; `getPattern`/`listNotes`/`listProblemsTool` signatures match
  their use in `register.ts`.
- **Known dependency to verify during Task 3:** `DifficultyCount` must be exported
  from `lib/db/statsPage.ts`; if it isn't yet, add `export` to its declaration
  (it is already the element type returned by `solvedByDifficulty`).
