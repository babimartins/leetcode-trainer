# DSA Trainer — Phase 2 (Tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user log practice attempts and browse/track problems — a reusable "log attempt" popover plus a filterable Problems board, both working on the existing schema without spaced-repetition scheduling (that is Phase 3).

**Architecture:** A `logAttempt` data helper inserts into `attempts` and updates the problem's `status` (derived from the attempt outcome) in one transaction. A `listProblems` helper returns one row per problem with aggregated pattern names and the latest-attempt summary, filtered by query params. A single client component, `LogAttemptForm`, renders a popover form and submits to a `logAttemptAction` server action; it is reused on the Problems board and the pattern detail page. The board is a server component that reads filters from `searchParams` and renders a GET filter form (no client JS for filtering).

**Tech Stack:** Next.js (App Router, TS), better-sqlite3, React client component (first in the app) + server action, Vitest + Testing Library.

## Global Constraints

- Runs locally via `npm run dev` on localhost:3000. Single user, no auth.
- TypeScript everywhere. App Router (`app/`), not Pages Router.
- All database access is server-side only; `better-sqlite3` is never imported into a client component. The `LogAttemptForm` client component receives the server action as a prop and never imports the db.
- SQLite db at `data/dsa.sqlite` (gitignored). No face emojis in UI; plain text labels.
- Do NOT show spaced-repetition internals (intervals) on the rating buttons. The rating is captured now; scheduling is Phase 3.
- Status values: `not_started`, `solving`, `solved` (the `needs_review` value is reserved for Phase 3 SRS — do not assign it here).
- Outcome→status mapping: `solved → 'solved'`, `partial → 'solving'`, `failed → 'solving'`.
- Reuse existing helpers/patterns: `getDb()` (lib/db/connection.ts), the data-helper convention (typed `*Row`, db-first arg — see lib/db/patterns.ts), and the server-action pattern (lib/notes/actions.ts).
- All SQL parameterized; filter values bound with `?`, never string-interpolated.

---

## File Structure

- `lib/db/attempts.ts` — `statusForOutcome`, `logAttempt`, `listAttemptsForProblem`, types.
- `lib/db/attempts.test.ts` — unit tests.
- `lib/db/problemsList.ts` — `listProblems(db, filters)` + types.
- `lib/db/problemsList.test.ts` — unit tests.
- `lib/db/sources.ts` — `listSources` (for the filter dropdown).
- `lib/db/sources.test.ts` — unit test.
- `lib/attempts/actions.ts` — `logAttemptAction` server action.
- `components/LogAttemptForm.tsx` — client popover form.
- `components/LogAttemptForm.test.tsx` — component test.
- `app/(shell)/problems/page.tsx` — Problems board (replaces placeholder).
- `app/(shell)/patterns/[slug]/page.tsx` — swap the read-only problem list for `LogAttemptForm` rows (modify).

---

## Task 1: Attempt logging data helpers (TDD)

**Files:**
- Create: `lib/db/attempts.ts`, `lib/db/attempts.test.ts`

**Interfaces:**
- Consumes: a `Database.Database` (tests pass in-memory; tests create `problems` and `attempts` tables inline).
- Produces:
  - `type Outcome = "solved" | "partial" | "failed"`
  - `type Rating = "hard" | "ok" | "easy"`
  - `interface AttemptRow { id: number; problem_id: number; date: string; outcome: string; rating: string | null; minutes: number | null; used_hint: number; reflection: string | null }`
  - `interface LogAttemptInput { problemId: number; outcome: Outcome; rating?: Rating | null; minutes?: number | null; usedHint?: boolean; reflection?: string | null }`
  - `statusForOutcome(outcome: Outcome): string` — `solved`→`"solved"`, `partial`/`failed`→`"solving"`.
  - `logAttempt(db, input: LogAttemptInput): AttemptRow` — inserts the attempt and updates `problems.status = statusForOutcome(outcome)` in one transaction; returns the created attempt row.
  - `listAttemptsForProblem(db, problemId: number): AttemptRow[]` — newest first (by id desc).

- [ ] **Step 1: Write the failing tests**

`lib/db/attempts.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  statusForOutcome,
  logAttempt,
  listAttemptsForProblem,
} from "./attempts";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      difficulty TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY,
      problem_id INTEGER NOT NULL, date TEXT NOT NULL DEFAULT (datetime('now')),
      outcome TEXT NOT NULL, rating TEXT, minutes INTEGER,
      used_hint INTEGER NOT NULL DEFAULT 0, reflection TEXT);
  `);
  db.prepare("INSERT INTO problems (id,title,difficulty) VALUES (1,'P','Medium')").run();
});

describe("statusForOutcome", () => {
  it("maps solved to solved, partial/failed to solving", () => {
    expect(statusForOutcome("solved")).toBe("solved");
    expect(statusForOutcome("partial")).toBe("solving");
    expect(statusForOutcome("failed")).toBe("solving");
  });
});

describe("logAttempt", () => {
  it("inserts an attempt and returns the created row", () => {
    const row = logAttempt(db, {
      problemId: 1,
      outcome: "solved",
      rating: "ok",
      minutes: 28,
      usedHint: true,
      reflection: "forgot to shrink",
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row).toMatchObject({
      problem_id: 1,
      outcome: "solved",
      rating: "ok",
      minutes: 28,
      used_hint: 1,
      reflection: "forgot to shrink",
    });
  });

  it("updates the problem status from the outcome", () => {
    logAttempt(db, { problemId: 1, outcome: "partial" });
    const status = (
      db.prepare("SELECT status FROM problems WHERE id = 1").get() as {
        status: string;
      }
    ).status;
    expect(status).toBe("solving");
  });

  it("defaults used_hint to 0 and nullable fields to null", () => {
    const row = logAttempt(db, { problemId: 1, outcome: "failed" });
    expect(row.used_hint).toBe(0);
    expect(row.rating).toBeNull();
    expect(row.minutes).toBeNull();
    expect(row.reflection).toBeNull();
  });
});

describe("listAttemptsForProblem", () => {
  it("returns attempts newest first", () => {
    logAttempt(db, { problemId: 1, outcome: "failed" });
    logAttempt(db, { problemId: 1, outcome: "solved" });
    const rows = listAttemptsForProblem(db, 1);
    expect(rows.map((r) => r.outcome)).toEqual(["solved", "failed"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/attempts.test.ts`
Expected: FAIL — cannot find `./attempts`.

- [ ] **Step 3: Implement the helpers**

`lib/db/attempts.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/attempts.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/attempts.ts lib/db/attempts.test.ts
git commit -m "feat: add attempt logging data helpers"
```

---

## Task 2: Problems list query with filters (TDD)

**Files:**
- Create: `lib/db/problemsList.ts`, `lib/db/problemsList.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create `problems`, `patterns`, `problem_patterns`, `sources`, `problem_sources`, `attempts` inline.
- Produces:
  - `interface ProblemFilters { q?: string; difficulty?: string; status?: string; patternSlug?: string; source?: string }`
  - `interface ProblemListRow { id: number; title: string; lc_url: string | null; difficulty: string; status: string; patterns: string | null; last_attempt_date: string | null; last_outcome: string | null }`
  - `listProblems(db, filters: ProblemFilters): ProblemListRow[]` — one row per problem, `patterns` is a comma-joined list of mapped pattern names (or null), and `last_attempt_date`/`last_outcome` come from the newest attempt (or null). Filters are ANDed; omitted/empty filters are ignored. Ordered by `title`.

- [ ] **Step 1: Write the failing tests**

`lib/db/problemsList.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listProblems } from "./problemsList";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      lc_url TEXT, difficulty TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE problem_patterns (problem_id INTEGER, pattern_id INTEGER, PRIMARY KEY(problem_id,pattern_id));
    CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE problem_sources (problem_id INTEGER, source_id INTEGER, PRIMARY KEY(problem_id,source_id));
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')), outcome TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty,status) VALUES (1,'Two Sum','u1','Easy','solved')").run();
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty,status) VALUES (2,'Min Window','u2','Hard','not_started')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (1,'Hash Map','hash-map')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (2,'Sliding Window','sliding-window')").run();
  db.prepare("INSERT INTO problem_patterns VALUES (1,1)").run();
  db.prepare("INSERT INTO problem_patterns VALUES (2,2)").run();
  db.prepare("INSERT INTO sources (id,name) VALUES (1,'Blind 75')").run();
  db.prepare("INSERT INTO problem_sources VALUES (1,1)").run();
  db.prepare("INSERT INTO attempts (problem_id,outcome) VALUES (1,'failed')").run();
  db.prepare("INSERT INTO attempts (problem_id,outcome) VALUES (1,'solved')").run();
});

describe("listProblems", () => {
  it("returns all problems with patterns and latest outcome, ordered by title", () => {
    const rows = listProblems(db, {});
    expect(rows.map((r) => r.title)).toEqual(["Min Window", "Two Sum"]);
    const twoSum = rows.find((r) => r.id === 1)!;
    expect(twoSum.patterns).toBe("Hash Map");
    expect(twoSum.last_outcome).toBe("solved"); // newest attempt
    const minWindow = rows.find((r) => r.id === 2)!;
    expect(minWindow.last_outcome).toBeNull();
  });

  it("filters by difficulty", () => {
    expect(listProblems(db, { difficulty: "Hard" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by status", () => {
    expect(listProblems(db, { status: "solved" }).map((r) => r.id)).toEqual([1]);
  });

  it("filters by pattern slug", () => {
    expect(listProblems(db, { patternSlug: "sliding-window" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by source name", () => {
    expect(listProblems(db, { source: "Blind 75" }).map((r) => r.id)).toEqual([1]);
  });

  it("filters by case-insensitive title search", () => {
    expect(listProblems(db, { q: "window" }).map((r) => r.id)).toEqual([2]);
  });

  it("ignores empty-string filters", () => {
    expect(listProblems(db, { q: "", difficulty: "", status: "" }).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/problemsList.test.ts`
Expected: FAIL — cannot find `./problemsList`.

- [ ] **Step 3: Implement the query**

`lib/db/problemsList.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/problemsList.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/problemsList.ts lib/db/problemsList.test.ts
git commit -m "feat: add filtered problems list query"
```

---

## Task 3: Sources list helper (TDD)

**Files:**
- Create: `lib/db/sources.ts`, `lib/db/sources.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`.
- Produces:
  - `interface SourceRow { id: number; name: string }`
  - `listSources(db): SourceRow[]` — ordered by `name`.

- [ ] **Step 1: Write the failing test**

`lib/db/sources.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listSources } from "./sources";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec("CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
  db.prepare("INSERT INTO sources (name) VALUES ('NeetCode 150')").run();
  db.prepare("INSERT INTO sources (name) VALUES ('Blind 75')").run();
});

describe("listSources", () => {
  it("returns sources ordered by name", () => {
    expect(listSources(db).map((s) => s.name)).toEqual(["Blind 75", "NeetCode 150"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/sources.test.ts`
Expected: FAIL — cannot find `./sources`.

- [ ] **Step 3: Implement the helper**

`lib/db/sources.ts`:
```ts
import type Database from "better-sqlite3";

export interface SourceRow {
  id: number;
  name: string;
}

export function listSources(db: Database.Database): SourceRow[] {
  return db
    .prepare("SELECT id, name FROM sources ORDER BY name")
    .all() as SourceRow[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/sources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/sources.ts lib/db/sources.test.ts
git commit -m "feat: add sources list helper"
```

---

## Task 4: logAttempt server action

**Files:**
- Create: `lib/attempts/actions.ts`

**Interfaces:**
- Consumes: `getDb()`, `logAttempt` + `Outcome`/`Rating` types (Task 1), `revalidatePath`.
- Produces: `logAttemptAction(formData: FormData): Promise<void>` — reads `problemId`, `outcome` (required; one of solved/partial/failed), `rating` (optional hard/ok/easy), `minutes` (optional int), `usedHint` (checkbox), `reflection` (optional), and `revalidate` (path string). No-ops if `problemId` or a valid `outcome` is missing. Calls `logAttempt`, then `revalidatePath(revalidate || "/problems")`.

- [ ] **Step 1: Implement the server action**

`lib/attempts/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { logAttempt, type Outcome, type Rating } from "@/lib/db/attempts";

const OUTCOMES: Outcome[] = ["solved", "partial", "failed"];
const RATINGS: Rating[] = ["hard", "ok", "easy"];

export async function logAttemptAction(formData: FormData): Promise<void> {
  const problemId = Number(formData.get("problemId"));
  const outcome = String(formData.get("outcome") ?? "") as Outcome;
  if (!problemId || !OUTCOMES.includes(outcome)) return;

  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = RATINGS.includes(ratingRaw as Rating)
    ? (ratingRaw as Rating)
    : null;

  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const minutes = minutesRaw === "" ? null : Number(minutesRaw);

  const reflection = String(formData.get("reflection") ?? "").trim() || null;
  const usedHint = formData.get("usedHint") != null;

  logAttempt(getDb(), {
    problemId,
    outcome,
    rating,
    minutes: minutes != null && Number.isFinite(minutes) ? minutes : null,
    usedHint,
    reflection,
  });

  const revalidate = String(formData.get("revalidate") ?? "") || "/problems";
  revalidatePath(revalidate);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/attempts/actions.ts
git commit -m "feat: add logAttempt server action"
```

---

## Task 5: LogAttemptForm client component (TDD)

**Files:**
- Create: `components/LogAttemptForm.tsx`, `components/LogAttemptForm.test.tsx`

**Interfaces:**
- Consumes: nothing from the db (it receives the action as a prop, keeping it db-free and testable).
- Produces:
  - `interface LogAttemptFormProps { problemId: number; problemTitle: string; lcUrl: string | null; difficulty?: string; revalidate: string; action: (formData: FormData) => void | Promise<void> }`
  - `LogAttemptForm(props): JSX.Element` — a client component (`"use client"`). Renders the problem title (a link to `lcUrl` in a new tab if non-null, otherwise a plain span — this satisfies the Phase 1 carry-forward note) and a "Log" toggle button. When open, shows a popover `<form action={action}>` with: outcome buttons (Solved/Partial/Failed), rating buttons (Hard/OK/Easy), a minutes number input, a "used a hint" checkbox, a reflection text input, and a "Log attempt" submit button. Outcome and rating are tracked in component state and carried via hidden inputs (`name="outcome"`, `name="rating"`); hidden inputs also carry `problemId` and `revalidate`. The submit button is disabled until an outcome is selected.

- [ ] **Step 1: Write the failing component test**

`components/LogAttemptForm.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogAttemptForm } from "./LogAttemptForm";

const noop = async () => {};

function setup() {
  return render(
    <LogAttemptForm
      problemId={7}
      problemTitle="Minimum Window Substring"
      lcUrl="https://leetcode.com/problems/minimum-window-substring/"
      difficulty="Hard"
      revalidate="/problems"
      action={noop}
    />
  );
}

describe("LogAttemptForm", () => {
  it("renders the title as a link to LeetCode opening in a new tab", () => {
    setup();
    const link = screen.getByRole("link", { name: /Minimum Window Substring/ });
    expect(link).toHaveAttribute(
      "href",
      "https://leetcode.com/problems/minimum-window-substring/"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a plain title (no link) when lcUrl is null", () => {
    render(
      <LogAttemptForm
        problemId={7}
        problemTitle="No URL Problem"
        lcUrl={null}
        revalidate="/problems"
        action={noop}
      />
    );
    expect(screen.queryByRole("link", { name: /No URL Problem/ })).toBeNull();
    expect(screen.getByText("No URL Problem")).toBeInTheDocument();
  });

  it("opens the form on Log and disables submit until an outcome is chosen", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Log attempt" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));

    const submit = screen.getByRole("button", { name: "Log attempt" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Solved" }));
    expect(submit).toBeEnabled();
  });

  it("reflects the chosen outcome in the hidden input", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    fireEvent.click(screen.getByRole("button", { name: "Partial" }));
    const hidden = container.querySelector(
      'input[type="hidden"][name="outcome"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("partial");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/LogAttemptForm.test.tsx`
Expected: FAIL — cannot find `./LogAttemptForm`.

- [ ] **Step 3: Implement the component**

`components/LogAttemptForm.tsx`:
```tsx
"use client";

import { useState } from "react";

export interface LogAttemptFormProps {
  problemId: number;
  problemTitle: string;
  lcUrl: string | null;
  difficulty?: string;
  revalidate: string;
  action: (formData: FormData) => void | Promise<void>;
}

const OUTCOMES: Array<{ value: string; label: string }> = [
  { value: "solved", label: "Solved" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
];
const RATINGS: Array<{ value: string; label: string }> = [
  { value: "hard", label: "Hard" },
  { value: "ok", label: "OK" },
  { value: "easy", label: "Easy" },
];

const chip = (active: boolean): React.CSSProperties => ({
  flex: 1,
  textAlign: "center",
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
  border: active
    ? "2px solid var(--accent)"
    : "1px solid var(--border)",
  background: active ? "rgba(99,102,241,0.12)" : "transparent",
  color: "var(--fg)",
  fontWeight: active ? 600 : 400,
});

export function LogAttemptForm(props: LogAttemptFormProps) {
  const { problemId, problemTitle, lcUrl, difficulty, revalidate, action } =
    props;
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [rating, setRating] = useState("");

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        {lcUrl ? (
          <a href={lcUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
            {problemTitle} ↗
          </a>
        ) : (
          <span style={{ fontWeight: 600 }}>{problemTitle}</span>
        )}
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {difficulty && (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{difficulty}</span>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
              cursor: "pointer",
            }}
          >
            {open ? "Close" : "Log"}
          </button>
        </span>
      </div>

      {open && (
        <form action={action} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="problemId" value={problemId} />
          <input type="hidden" name="revalidate" value={revalidate} />
          <input type="hidden" name="outcome" value={outcome} />
          <input type="hidden" name="rating" value={rating} />

          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
              Outcome
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  style={chip(outcome === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
              How did it feel?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRating(r.value)}
                  style={chip(rating === r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Time (min){" "}
              <input
                type="number"
                name="minutes"
                min={0}
                style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
              />
            </label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              <input type="checkbox" name="usedHint" /> used a hint
            </label>
          </div>

          <input
            type="text"
            name="reflection"
            placeholder="Reflection (optional)"
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={outcome === ""}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: outcome === "" ? "var(--border)" : "var(--accent)",
                color: "white",
                fontWeight: 600,
                cursor: outcome === "" ? "not-allowed" : "pointer",
              }}
            >
              Log attempt
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/LogAttemptForm.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/LogAttemptForm.tsx components/LogAttemptForm.test.tsx
git commit -m "feat: add reusable LogAttemptForm popover component"
```

---

## Task 6: Problems board page

**Files:**
- Modify: `app/(shell)/problems/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getDb()`, `listProblems`/`ProblemFilters` (Task 2), `listPatterns` (existing lib/db/patterns.ts), `listSources` (Task 3), `LogAttemptForm` (Task 5), `logAttemptAction` (Task 4).
- Produces: the board at `/problems` — a GET filter form (search + Pattern/Difficulty/Status/Source selects) reading current values from `searchParams`, and a table of problems with a `LogAttemptForm` per row.

- [ ] **Step 1: Implement the board page**

`app/(shell)/problems/page.tsx`:
```tsx
import { getDb } from "@/lib/db/connection";
import { listProblems, type ProblemFilters } from "@/lib/db/problemsList";
import { listPatterns } from "@/lib/db/patterns";
import { listSources } from "@/lib/db/sources";
import { LogAttemptForm } from "@/components/LogAttemptForm";
import { logAttemptAction } from "@/lib/attempts/actions";

export const dynamic = "force-dynamic";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const STATUSES = [
  { value: "not_started", label: "not started" },
  { value: "solving", label: "solving" },
  { value: "solved", label: "solved" },
];

function val(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

const selectStyle = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--fg)",
} as const;

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters: ProblemFilters = {
    q: val(sp, "q"),
    difficulty: val(sp, "difficulty"),
    status: val(sp, "status"),
    patternSlug: val(sp, "pattern"),
    source: val(sp, "source"),
  };

  const db = getDb();
  const problems = listProblems(db, filters);
  const patterns = listPatterns(db);
  const sources = listSources(db);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Problems</h1>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="Search problems…"
          style={{ ...selectStyle, flex: 1, minWidth: 160 }}
        />
        <select name="pattern" defaultValue={filters.patternSlug} style={selectStyle}>
          <option value="">Pattern: All</option>
          {patterns.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <select name="difficulty" defaultValue={filters.difficulty} style={selectStyle}>
          <option value="">Difficulty: All</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} style={selectStyle}>
          <option value="">Status: All</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select name="source" defaultValue={filters.source} style={selectStyle}>
          <option value="">List: All</option>
          {sources.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button type="submit" style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}>
          Filter
        </button>
        <a href="/problems" style={{ ...selectStyle, color: "var(--muted)" }}>Clear</a>
      </form>

      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        {problems.length} problem{problems.length === 1 ? "" : "s"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {problems.map((p) => (
          <div key={p.id}>
            <LogAttemptForm
              problemId={p.id}
              problemTitle={p.title}
              lcUrl={p.lc_url}
              difficulty={p.difficulty}
              revalidate="/problems"
              action={logAttemptAction}
            />
            <div style={{ display: "flex", gap: 12, padding: "2px 12px 0", fontSize: 12, color: "var(--muted)" }}>
              <span>{p.patterns ?? "—"}</span>
              <span>· {p.status.replace("_", " ")}</span>
              {p.last_outcome && <span>· last: {p.last_outcome}</span>}
            </div>
          </div>
        ))}
        {problems.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No problems match these filters.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the board in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1; npm run dev`
Then load `http://localhost:3000/problems`.
Expected: three seeded problems listed, each with a "Log" button and a pattern/status line; the filter bar shows Pattern/Difficulty/Status/List selects. Try `http://localhost:3000/problems?difficulty=Medium` → all three (all Medium) show; `?q=koko` → only "Koko Eating Bananas". Stop the dev server.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/problems/page.tsx"
git commit -m "feat: add problems board with filters and inline logging"
```

---

## Task 7: Wire LogAttemptForm into the pattern detail page

**Files:**
- Modify: `app/(shell)/patterns/[slug]/page.tsx`

**Interfaces:**
- Consumes: `LogAttemptForm` (Task 5), `logAttemptAction` (Task 4). Existing: `listProblemsForPattern` already returns `ProblemRow { id, title, lc_url, difficulty, status }`.
- Produces: the pattern detail "Problems in this pattern" section now renders an interactive `LogAttemptForm` per mapped problem (replacing the read-only links), so the user can log an attempt without leaving the page. Resolves the Phase 1 carry-forward note (null `lc_url` renders a span, handled inside `LogAttemptForm`).

- [ ] **Step 1: Read the current file to locate the problems section**

Run: `sed -n '1,200p' "app/(shell)/patterns/[slug]/page.tsx"`
Identify the import block, and the "Problems in this pattern" `<section>` added in Phase 1 Task 8 (it maps `problems` to `<a>` elements).

- [ ] **Step 2: Add the imports**

Add these two imports alongside the existing imports at the top of `app/(shell)/patterns/[slug]/page.tsx`:
```tsx
import { LogAttemptForm } from "@/components/LogAttemptForm";
import { logAttemptAction } from "@/lib/attempts/actions";
```

- [ ] **Step 3: Replace the problem-list rendering**

In the "Problems in this pattern" section, replace the inner `{problems.map((p) => ( <a ...>...</a> ))}` block (the read-only links) with:
```tsx
          {problems.map((p) => (
            <LogAttemptForm
              key={p.id}
              problemId={p.id}
              problemTitle={p.title}
              lcUrl={p.lc_url}
              difficulty={p.difficulty}
              revalidate={`/patterns/${slug}`}
              action={logAttemptAction}
            />
          ))}
```
Leave the surrounding `<section>`, heading, the `flexDirection: "column"` wrapper, and the `problems.length === 0` empty state unchanged.

- [ ] **Step 4: Verify in the browser (full log round-trip)**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1; npm run dev`
Then load `http://localhost:3000/patterns/sliding-window`.
Expected: under "Problems in this pattern", "Longest Substring Without Repeating Characters" shows with a "Log" button. Click Log → pick "Solved" → "Log attempt"; the attempt is recorded. Verify with:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log(db.prepare('SELECT problem_id, outcome FROM attempts').all(), db.prepare(\"SELECT title,status FROM problems WHERE status<>'not_started'\").all())})"`
Expected: one attempt row (outcome 'solved') and the problem's status now 'solved'. Stop the dev server.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(shell)/patterns/[slug]/page.tsx"
git commit -m "feat: enable inline attempt logging on the pattern page"
```

---

## Definition of Done (Phase 2)

- `/problems` lists problems with search + Pattern/Difficulty/Status/List filters (server-rendered via query params).
- Each problem (on the board and on the pattern page) has a reusable "Log" popover: outcome, how-it-felt rating, time, used-hint, reflection — submitted via a server action.
- Logging an attempt records it in `attempts` and updates the problem's `status` (solved→solved, partial/failed→solving).
- Problems with no LeetCode URL render a plain title (no dead link).
- `npm test` passes (Phase 0/1 tests + new attempt/list/sources/component tests).
- No SRS scheduling or "next review"/"needs review" surfaces (deferred to Phase 3).

## Self-Review Notes

- **Spec coverage:** Problems board with filters (§8.3) ✓ Task 6; reusable log-attempt popover with outcome/rating/time/hint/reflection (§8 reusable components) ✓ Tasks 4–5, reused in Tasks 6–7; attempt history + status from attempts (§4) ✓ Task 1; "works on the same data model, SRS layered later" (§11 Phase 2) ✓ — no reviews/SRS touched. The "next review" column and "needs review" status are intentionally deferred to Phase 3 (noted in constraints).
- **Carry-forward from Phase 1:** null `lc_url` → span not link — handled in `LogAttemptForm` (Task 5) and exercised on both surfaces.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `Outcome`, `Rating`, `AttemptRow`, `LogAttemptInput`, `statusForOutcome`, `logAttempt`, `listAttemptsForProblem`, `ProblemFilters`, `ProblemListRow`, `listProblems`, `SourceRow`, `listSources`, `logAttemptAction`, `LogAttemptForm`/`LogAttemptFormProps` are consistent across tasks. The board passes `action={logAttemptAction}` and `revalidate` strings matching the action's expectations.
- **First client component:** `LogAttemptForm` is the app's first `"use client"` component; it receives the server action as a prop and imports no db code, preserving the server-only DB boundary.
