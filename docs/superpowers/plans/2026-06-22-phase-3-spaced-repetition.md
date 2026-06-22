# DSA Trainer — Phase 3 (Spaced Repetition) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spaced-repetition scheduling — rating an attempt or a pattern recall schedules its next review (SM-2), a Review queue surfaces what's due, and a Today screen shows the day's stats and due items.

**Architecture:** A pure `nextReview(state, rating)` function computes the next `(ease, intervalDays)` from a 3-button rating; `recordReview` upserts the per-item `reviews` row (ease, interval, due_date) using `addDays(today, interval)`. Problems schedule via the existing attempt-logging action (when a rating is given); patterns schedule via a new "Review this pattern" action. The Review queue and Today pages read due items and aggregate stats with server-side helpers. No new schema — the `reviews` table from Phase 0 already has `ease`, `interval_days`, `due_date`, `last_reviewed`, and `UNIQUE(item_type, item_id)`.

**Tech Stack:** Next.js (App Router, TS), better-sqlite3, server actions, Vitest.

## Global Constraints

- Runs locally via `npm run dev` on localhost:3000. Single user, no auth.
- TypeScript everywhere; App Router; DB access server-side only; `better-sqlite3` never imported into a client component.
- No face emojis; plain text labels.
- **Do NOT display the computed next-review interval on the rating buttons** (Hard/OK/Easy). The interval is computed server-side only. (User preference.)
- Status values stay `not_started`/`solving`/`solved`. Spaced-repetition state lives only in the `reviews` table; `status` is not driven by reviews.
- Both problems and patterns are reviewable with independent schedules: `reviews.item_type` is `'problem'` or `'pattern'`, `reviews.item_id` is the row id in the respective table.
- Dates are stored and compared as `YYYY-MM-DD` strings (lexicographic compare is correct for ISO dates).
- SM-2 parameters (verbatim): ease default `2.5`, ease floor `1.3`, hard `ease -= 0.2`, easy `ease += 0.15`. First-review intervals: hard `1`, ok `3`, easy `4` days. Subsequent intervals: hard `max(1, round(interval*1.2))`, ok `round(interval*ease)`, easy `round(interval*ease*1.3)`. Ease is rounded to 2 decimals.
- Reuse existing helpers/patterns: `getDb()`, the data-helper convention (typed `*Row`, db-first arg), and the server-action pattern (`lib/attempts/actions.ts`).
- All SQL parameterized.

---

## File Structure

- `lib/srs/sm2.ts` — `nextReview` + `ReviewState` type.
- `lib/srs/sm2.test.ts` — unit tests.
- `lib/srs/dates.ts` — `addDays`, `todayIso`.
- `lib/srs/dates.test.ts` — unit tests (addDays).
- `lib/db/reviews.ts` — `getReviewState`, `recordReview`, `getDueItems` + types.
- `lib/db/reviews.test.ts` — unit tests.
- `lib/db/stats.ts` — `dueCount`, `solvedCount`, `patternsProgress`, `currentStreak`, `lastAttemptedProblem` + types.
- `lib/db/stats.test.ts` — unit tests.
- `lib/reviews/actions.ts` — `recordReviewAction`, `recordPatternReviewAction` server actions.
- `lib/attempts/actions.ts` — modify `logAttemptAction` to schedule a problem review when a rating is given.
- `app/(shell)/patterns/[slug]/page.tsx` — add a "Review this pattern" rating form (modify).
- `app/(shell)/review/page.tsx` — the Review queue (replace placeholder).
- `app/(shell)/page.tsx` — the Today screen (replace placeholder heading).

---

## Task 1: SM-2 engine + date utilities (TDD)

**Files:**
- Create: `lib/srs/sm2.ts`, `lib/srs/sm2.test.ts`, `lib/srs/dates.ts`, `lib/srs/dates.test.ts`

**Interfaces:**
- Produces:
  - `interface ReviewState { ease: number; intervalDays: number }`
  - `type Rating = "hard" | "ok" | "easy"`
  - `nextReview(state: ReviewState, rating: Rating): ReviewState` — pure; applies the SM-2 parameters from Global Constraints. Ease floored at 1.3 and rounded to 2 decimals.
  - `addDays(iso: string, days: number): string` — pure; `iso` is `YYYY-MM-DD`, returns `YYYY-MM-DD` (UTC arithmetic, DST-safe).
  - `todayIso(): string` — local current date as `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests**

`lib/srs/sm2.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextReview } from "./sm2";

describe("nextReview — first review (intervalDays 0)", () => {
  it("ok sets 3 days, ease unchanged", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "ok")).toEqual({
      ease: 2.5,
      intervalDays: 3,
    });
  });
  it("easy sets 4 days and raises ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "easy")).toEqual({
      ease: 2.65,
      intervalDays: 4,
    });
  });
  it("hard sets 1 day and lowers ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 0 }, "hard")).toEqual({
      ease: 2.3,
      intervalDays: 1,
    });
  });
});

describe("nextReview — subsequent reviews", () => {
  it("ok multiplies interval by ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 3 }, "ok")).toEqual({
      ease: 2.5,
      intervalDays: 8, // round(7.5)
    });
  });
  it("easy raises ease then grows interval", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 8 }, "easy")).toEqual({
      ease: 2.65,
      intervalDays: 28, // round(8 * 2.65 * 1.3)
    });
  });
  it("hard lowers ease and shrinks interval growth", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 8 }, "hard")).toEqual({
      ease: 2.3,
      intervalDays: 10, // max(1, round(9.6))
    });
  });
  it("floors ease at 1.3", () => {
    expect(nextReview({ ease: 1.3, intervalDays: 5 }, "hard").ease).toBe(1.3);
  });
});
```

`lib/srs/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addDays } from "./dates";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-06-22", 3)).toBe("2026-06-25");
  });
  it("rolls over a month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("subtracts days", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/srs/sm2.test.ts lib/srs/dates.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the utilities**

`lib/srs/sm2.ts`:
```ts
export interface ReviewState {
  ease: number;
  intervalDays: number;
}

export type Rating = "hard" | "ok" | "easy";

const EASE_FLOOR = 1.3;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function nextReview(state: ReviewState, rating: Rating): ReviewState {
  let ease = state.ease;
  let intervalDays: number;

  if (rating === "hard") {
    ease = Math.max(EASE_FLOOR, round2(ease - 0.2));
  } else if (rating === "easy") {
    ease = round2(ease + 0.15);
  }

  if (state.intervalDays <= 0) {
    intervalDays = rating === "hard" ? 1 : rating === "ok" ? 3 : 4;
  } else if (rating === "hard") {
    intervalDays = Math.max(1, Math.round(state.intervalDays * 1.2));
  } else if (rating === "ok") {
    intervalDays = Math.round(state.intervalDays * ease);
  } else {
    intervalDays = Math.round(state.intervalDays * ease * 1.3);
  }

  return { ease, intervalDays };
}
```

`lib/srs/dates.ts`:
```ts
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/srs/sm2.test.ts lib/srs/dates.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/srs/sm2.ts lib/srs/sm2.test.ts lib/srs/dates.ts lib/srs/dates.test.ts
git commit -m "feat: add SM-2 scheduling and date utilities"
```

---

## Task 2: Reviews data layer (TDD)

**Files:**
- Create: `lib/db/reviews.ts`, `lib/db/reviews.test.ts`

**Interfaces:**
- Consumes: `nextReview`, `ReviewState`, `Rating` (Task 1, from `@/lib/srs/sm2`); `addDays` (Task 1, from `@/lib/srs/dates`). Tests create `reviews`, `problems`, `patterns` tables inline.
- Produces:
  - `type ItemType = "problem" | "pattern"`
  - `getReviewState(db, itemType: ItemType, itemId: number): ReviewState` — returns the stored `{ ease, intervalDays }`, or the default `{ ease: 2.5, intervalDays: 0 }` if no row exists.
  - `recordReview(db, itemType: ItemType, itemId: number, rating: Rating, today: string): void` — computes `nextReview` from the current state, sets `due_date = addDays(today, intervalDays)` and `last_reviewed = today`, and upserts the `reviews` row (on conflict of `(item_type, item_id)`).
  - `interface DueItem { item_type: string; item_id: number; title: string; slug: string | null; lc_url: string | null; difficulty: string | null; due_date: string }`
  - `getDueItems(db, today: string): DueItem[]` — reviews with `due_date <= today`, joined to `problems` (title/lc_url/difficulty) or `patterns` (name as title, slug), ordered by `due_date`.

- [ ] **Step 1: Write the failing tests**

`lib/db/reviews.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getReviewState, recordReview, getDueItems } from "./reviews";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE reviews (id INTEGER PRIMARY KEY,
      item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL NOT NULL DEFAULT 2.5, interval_days INTEGER NOT NULL DEFAULT 0,
      due_date TEXT, last_reviewed TEXT, UNIQUE(item_type, item_id));
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, lc_url TEXT, difficulty TEXT NOT NULL);
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (1,'Two Sum','u1','Easy')").run();
  db.prepare("INSERT INTO patterns (id,name,slug) VALUES (1,'Sliding Window','sliding-window')").run();
});

describe("getReviewState", () => {
  it("returns the default for an unseen item", () => {
    expect(getReviewState(db, "problem", 1)).toEqual({ ease: 2.5, intervalDays: 0 });
  });
});

describe("recordReview", () => {
  it("creates a review row with computed interval and due date", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22");
    const row = db.prepare("SELECT * FROM reviews WHERE item_type='problem' AND item_id=1").get() as any;
    expect(row.interval_days).toBe(3);
    expect(row.due_date).toBe("2026-06-25");
    expect(row.last_reviewed).toBe("2026-06-22");
  });

  it("upserts (no duplicate) and advances the schedule on the second review", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // interval 3
    recordReview(db, "problem", 1, "ok", "2026-06-25"); // interval round(3*2.5)=8
    const rows = db.prepare("SELECT * FROM reviews WHERE item_type='problem' AND item_id=1").all();
    expect(rows.length).toBe(1);
    expect(getReviewState(db, "problem", 1)).toEqual({ ease: 2.5, intervalDays: 8 });
  });

  it("keeps problem and pattern schedules independent", () => {
    recordReview(db, "problem", 1, "easy", "2026-06-22");
    recordReview(db, "pattern", 1, "hard", "2026-06-22");
    expect(getReviewState(db, "problem", 1).intervalDays).toBe(4);
    expect(getReviewState(db, "pattern", 1).intervalDays).toBe(1);
  });
});

describe("getDueItems", () => {
  it("returns problems and patterns due on or before today, with display fields", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // due 2026-06-25
    recordReview(db, "pattern", 1, "hard", "2026-06-22"); // due 2026-06-23
    const due = getDueItems(db, "2026-06-25");
    expect(due.map((d) => `${d.item_type}:${d.item_id}`).sort()).toEqual([
      "pattern:1",
      "problem:1",
    ]);
    const problem = due.find((d) => d.item_type === "problem")!;
    expect(problem.title).toBe("Two Sum");
    expect(problem.lc_url).toBe("u1");
    const pattern = due.find((d) => d.item_type === "pattern")!;
    expect(pattern.title).toBe("Sliding Window");
    expect(pattern.slug).toBe("sliding-window");
  });

  it("excludes items not yet due", () => {
    recordReview(db, "problem", 1, "ok", "2026-06-22"); // due 2026-06-25
    expect(getDueItems(db, "2026-06-24")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/reviews.test.ts`
Expected: FAIL — cannot find `./reviews`.

- [ ] **Step 3: Implement the data layer**

`lib/db/reviews.ts`:
```ts
import type Database from "better-sqlite3";
import { nextReview, type ReviewState, type Rating } from "@/lib/srs/sm2";
import { addDays } from "@/lib/srs/dates";

export type ItemType = "problem" | "pattern";

export interface DueItem {
  item_type: string;
  item_id: number;
  title: string;
  slug: string | null;
  lc_url: string | null;
  difficulty: string | null;
  due_date: string;
}

export function getReviewState(
  db: Database.Database,
  itemType: ItemType,
  itemId: number
): ReviewState {
  const row = db
    .prepare(
      "SELECT ease, interval_days FROM reviews WHERE item_type = ? AND item_id = ?"
    )
    .get(itemType, itemId) as
    | { ease: number; interval_days: number }
    | undefined;
  if (!row) return { ease: 2.5, intervalDays: 0 };
  return { ease: row.ease, intervalDays: row.interval_days };
}

export function recordReview(
  db: Database.Database,
  itemType: ItemType,
  itemId: number,
  rating: Rating,
  today: string
): void {
  const next = nextReview(getReviewState(db, itemType, itemId), rating);
  const dueDate = addDays(today, next.intervalDays);
  db.prepare(
    `INSERT INTO reviews (item_type, item_id, ease, interval_days, due_date, last_reviewed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_type, item_id) DO UPDATE SET
       ease = excluded.ease,
       interval_days = excluded.interval_days,
       due_date = excluded.due_date,
       last_reviewed = excluded.last_reviewed`
  ).run(itemType, itemId, next.ease, next.intervalDays, dueDate, today);
}

export function getDueItems(db: Database.Database, today: string): DueItem[] {
  return db
    .prepare(
      `SELECT r.item_type, r.item_id, p.title AS title, NULL AS slug,
              p.lc_url AS lc_url, p.difficulty AS difficulty, r.due_date AS due_date
         FROM reviews r JOIN problems p ON p.id = r.item_id
        WHERE r.item_type = 'problem' AND r.due_date IS NOT NULL AND r.due_date <= ?
       UNION ALL
       SELECT r.item_type, r.item_id, pa.name AS title, pa.slug AS slug,
              NULL AS lc_url, NULL AS difficulty, r.due_date AS due_date
         FROM reviews r JOIN patterns pa ON pa.id = r.item_id
        WHERE r.item_type = 'pattern' AND r.due_date IS NOT NULL AND r.due_date <= ?
       ORDER BY due_date`
    )
    .all(today, today) as DueItem[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/reviews.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/reviews.ts lib/db/reviews.test.ts
git commit -m "feat: add reviews data layer (record + due items)"
```

---

## Task 3: Today-screen stats helpers (TDD)

**Files:**
- Create: `lib/db/stats.ts`, `lib/db/stats.test.ts`

**Interfaces:**
- Consumes: `addDays` (Task 1). Tests create `problems`, `patterns`, `reviews`, `attempts` inline.
- Produces:
  - `dueCount(db, today: string): number` — count of `reviews` with `due_date <= today`.
  - `solvedCount(db): number` — count of `problems` with `status = 'solved'`.
  - `patternsProgress(db): { started: number; total: number }` — `started` = patterns with `status <> 'not_started'`; `total` = all patterns.
  - `currentStreak(db, today: string): number` — number of consecutive days ending at `today` that have at least one attempt (counts `today` only if it has an attempt; stops at the first gap).
  - `interface ResumeProblem { id: number; title: string; lc_url: string | null }`
  - `lastAttemptedProblem(db): ResumeProblem | null` — the problem of the most recent attempt, or null.

- [ ] **Step 1: Write the failing tests**

`lib/db/stats.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  dueCount,
  solvedCount,
  patternsProgress,
  currentStreak,
  lastAttemptedProblem,
} from "./stats";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, lc_url TEXT,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, due_date TEXT);
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL, date TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,status) VALUES (1,'A','u1','solved')").run();
  db.prepare("INSERT INTO problems (id,title,lc_url,status) VALUES (2,'B','u2','solving')").run();
  db.prepare("INSERT INTO patterns (id,status) VALUES (1,'learning'),(2,'not_started'),(3,'not_started')").run();
});

describe("dueCount", () => {
  it("counts reviews due on or before today", () => {
    db.prepare("INSERT INTO reviews (item_type,item_id,due_date) VALUES ('problem',1,'2026-06-20')").run();
    db.prepare("INSERT INTO reviews (item_type,item_id,due_date) VALUES ('problem',2,'2026-06-25')").run();
    expect(dueCount(db, "2026-06-22")).toBe(1);
  });
});

describe("solvedCount / patternsProgress", () => {
  it("counts solved problems and started patterns", () => {
    expect(solvedCount(db)).toBe(1);
    expect(patternsProgress(db)).toEqual({ started: 1, total: 3 });
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-22 09:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-21 10:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(3);
  });
  it("is zero when today has no attempt", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(0);
  });
  it("stops at the first gap", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-22 09:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    expect(currentStreak(db, "2026-06-22")).toBe(1);
  });
});

describe("lastAttemptedProblem", () => {
  it("returns the most recently attempted problem", () => {
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (1,'2026-06-20 11:00:00')").run();
    db.prepare("INSERT INTO attempts (problem_id,date) VALUES (2,'2026-06-21 11:00:00')").run();
    expect(lastAttemptedProblem(db)).toEqual({ id: 2, title: "B", lc_url: "u2" });
  });
  it("returns null with no attempts", () => {
    expect(lastAttemptedProblem(db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/stats.test.ts`
Expected: FAIL — cannot find `./stats`.

- [ ] **Step 3: Implement the helpers**

`lib/db/stats.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/stats.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/stats.ts lib/db/stats.test.ts
git commit -m "feat: add Today-screen stats helpers"
```

---

## Task 4: Review server actions + wire attempt logging to scheduling

**Files:**
- Create: `lib/reviews/actions.ts`
- Modify: `lib/attempts/actions.ts`

**Interfaces:**
- Consumes: `getDb()`, `recordReview`/`ItemType` (Task 2), `todayIso` (Task 1), `logAttempt`/`Rating` (existing `lib/db/attempts.ts`), `revalidatePath`.
- Produces:
  - `recordReviewAction(formData: FormData): Promise<void>` — reads `itemType` (problem|pattern), `itemId`, `rating` (hard/ok/easy), `revalidate`. No-ops on invalid input. Calls `recordReview(getDb(), itemType, itemId, rating, todayIso())`, then `revalidatePath(revalidate || "/review")`.
  - `recordPatternReviewAction(formData: FormData): Promise<void>` — reads `patternId`, `slug`, `rating`. No-ops on invalid input. Calls `recordReview(getDb(), "pattern", patternId, rating, todayIso())`, then `revalidatePath("/patterns/" + slug)`.
  - Modified `logAttemptAction`: after `logAttempt(...)`, when `rating` is non-null, also calls `recordReview(getDb(), "problem", problemId, rating, todayIso())` so a rated problem attempt schedules its next review.

- [ ] **Step 1: Implement the review actions**

`lib/reviews/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { recordReview, type ItemType } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
import type { Rating } from "@/lib/srs/sm2";

const ITEM_TYPES: ItemType[] = ["problem", "pattern"];
const RATINGS: Rating[] = ["hard", "ok", "easy"];

export async function recordReviewAction(formData: FormData): Promise<void> {
  const itemType = String(formData.get("itemType") ?? "") as ItemType;
  const itemId = Number(formData.get("itemId"));
  const rating = String(formData.get("rating") ?? "") as Rating;
  if (!ITEM_TYPES.includes(itemType) || !itemId || !RATINGS.includes(rating)) {
    return;
  }
  recordReview(getDb(), itemType, itemId, rating, todayIso());
  const revalidate = String(formData.get("revalidate") ?? "") || "/review";
  revalidatePath(revalidate);
}

export async function recordPatternReviewAction(
  formData: FormData
): Promise<void> {
  const patternId = Number(formData.get("patternId"));
  const slug = String(formData.get("slug") ?? "");
  const rating = String(formData.get("rating") ?? "") as Rating;
  if (!patternId || !RATINGS.includes(rating)) return;
  recordReview(getDb(), "pattern", patternId, rating, todayIso());
  revalidatePath("/patterns/" + slug);
}
```

- [ ] **Step 2: Wire attempt logging to scheduling**

In `lib/attempts/actions.ts`, add these imports next to the existing ones:
```ts
import { recordReview } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
```
Then, immediately after the existing `logAttempt(getDb(), { ... });` call in `logAttemptAction`, add:
```ts
  if (rating) {
    recordReview(getDb(), "problem", problemId, rating, todayIso());
  }
```
(`rating` is the already-validated `Rating | null` computed earlier in that function; only schedule when it is non-null.)

- [ ] **Step 3: Type-check**

Run: `node node_modules/typescript/bin/tsc --noEmit` (do NOT use `npx tsc` — it installs a bogus package)
Expected: exit 0.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all suites pass (unchanged count — no new tests this task).

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/actions.ts lib/attempts/actions.ts
git commit -m "feat: add review actions and schedule problem reviews on rating"
```

---

## Task 5: "Review this pattern" form on the pattern page

**Files:**
- Modify: `app/(shell)/patterns/[slug]/page.tsx`

**Interfaces:**
- Consumes: `recordPatternReviewAction` (Task 4).
- Produces: a "Review this pattern" section near the top of the pattern detail page with three rating submit buttons (Hard / OK / Easy) that schedule the pattern's next review. No interval text on the buttons.

- [ ] **Step 1: Read the current file to find the insertion point**

Run: `sed -n '1,60p' "app/(shell)/patterns/[slug]/page.tsx"`
Locate the imports and the `<h1>{pattern.name}</h1>` line.

- [ ] **Step 2: Add the import**

Add alongside the existing imports in `app/(shell)/patterns/[slug]/page.tsx`:
```tsx
import { recordPatternReviewAction } from "@/lib/reviews/actions";
```

- [ ] **Step 3: Add the review form under the title**

Immediately after the `<h1>{pattern.name}</h1>` line, insert:
```tsx
      <form
        action={recordPatternReviewAction}
        style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 4px" }}
      >
        <input type="hidden" name="patternId" value={pattern.id} />
        <input type="hidden" name="slug" value={slug} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Review this pattern:</span>
        {(["hard", "ok", "easy"] as const).map((r) => (
          <button
            key={r}
            type="submit"
            name="rating"
            value={r}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {r}
          </button>
        ))}
      </form>
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1; npm run dev`
Then load `http://localhost:3000/patterns/sliding-window`.
Expected: under the title, "Review this pattern:" with Hard / OK / Easy buttons. Click "OK". Verify a review row was created:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log(db.prepare(\"SELECT item_type,item_id,interval_days,due_date FROM reviews WHERE item_type='pattern'\").all())})"`
Expected: one row, `item_type 'pattern'`, `interval_days 3`, a `due_date` ~3 days out. Stop the dev server.

- [ ] **Step 5: Type-check and full suite**

Run: `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0), then `npm test` (expect all pass).

- [ ] **Step 6: Commit**

```bash
git add "app/(shell)/patterns/[slug]/page.tsx"
git commit -m "feat: add pattern review rating to the pattern page"
```

---

## Task 6: Review queue page

**Files:**
- Modify: `app/(shell)/review/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getDb()`, `getDueItems` (Task 2), `todayIso` (Task 1), `recordReviewAction` (Task 4).
- Produces: the Review queue at `/review` — lists items due today/earlier; each shows its title (problems link to LeetCode in a new tab, patterns link to their detail page) and Hard/OK/Easy rating buttons that reschedule it (dropping it from the list on the next render). Empty state when nothing is due.

- [ ] **Step 1: Implement the page**

`app/(shell)/review/page.tsx`:
```tsx
import { getDb } from "@/lib/db/connection";
import { getDueItems } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
import { recordReviewAction } from "@/lib/reviews/actions";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const due = getDueItems(getDb(), todayIso());

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Review queue</h1>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 16px" }}>
        {due.length} item{due.length === 1 ? "" : "s"} due
      </p>

      {due.length === 0 && (
        <p style={{ color: "var(--muted)" }}>All caught up — nothing due today.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {due.map((item) => (
          <div
            key={`${item.item_type}:${item.item_id}`}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              {item.item_type === "problem" && item.lc_url ? (
                <a href={item.lc_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {item.title} ↗
                </a>
              ) : item.item_type === "pattern" && item.slug ? (
                <a href={`/patterns/${item.slug}`} style={{ fontWeight: 600 }}>
                  {item.title}
                </a>
              ) : (
                <span style={{ fontWeight: 600 }}>{item.title}</span>
              )}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {item.item_type}
              </span>
            </div>
            <form action={recordReviewAction} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="hidden" name="itemType" value={item.item_type} />
              <input type="hidden" name="itemId" value={item.item_id} />
              <input type="hidden" name="revalidate" value="/review" />
              {(["hard", "ok", "easy"] as const).map((r) => (
                <button
                  key={r}
                  type="submit"
                  name="rating"
                  value={r}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--fg)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {r}
                </button>
              ))}
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1`
Seed a due item directly, then check the page:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');db.prepare(\"INSERT OR IGNORE INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('problem',1,2.5,1,date('now','-1 day'),date('now','-2 day'))\").run();console.log('seeded due review')})"`
Run `npm run dev`, load `http://localhost:3000/review`.
Expected: "1 item due" and the problem row with Hard/OK/Easy buttons. Click "OK" → the item reschedules into the future and the list shows "All caught up". Stop the dev server.

- [ ] **Step 3: Type-check and full suite**

Run: `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0), then `npm test` (expect all pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/review/page.tsx"
git commit -m "feat: add review queue page"
```

---

## Task 7: Today screen

**Files:**
- Modify: `app/(shell)/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getDb()`, `dueCount`/`solvedCount`/`patternsProgress`/`currentStreak`/`lastAttemptedProblem` (Task 3), `getDueItems` (Task 2), `todayIso` (Task 1).
- Produces: the Today screen at `/` — greeting + date + streak; a stat row (due / solved / patterns started); a resume card (last attempted problem) when present; a "Study a pattern" link to `/patterns`; and a short list of due items linking to `/review`.

- [ ] **Step 1: Implement the page**

`app/(shell)/page.tsx`:
```tsx
import Link from "next/link";
import { getDb } from "@/lib/db/connection";
import { getDueItems } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
import {
  dueCount,
  solvedCount,
  patternsProgress,
  currentStreak,
  lastAttemptedProblem,
} from "@/lib/db/stats";

export const dynamic = "force-dynamic";

const card = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 14px",
} as const;

export default function TodayPage() {
  const db = getDb();
  const today = todayIso();
  const due = dueCount(db, today);
  const solved = solvedCount(db);
  const patterns = patternsProgress(db);
  const streak = currentStreak(db, today);
  const resume = lastAttemptedProblem(db);
  const dueItems = getDueItems(db, today).slice(0, 5);

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Today</h1>
        <span style={{ color: "var(--muted)" }}>
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </span>
      </div>
      <div style={{ color: "var(--muted)", marginBottom: 18 }}>{today}</div>

      {resume && (
        <div style={{ border: "1px solid var(--accent)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>
            Resume where you left off
          </div>
          {resume.lc_url ? (
            <a href={resume.lc_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
              {resume.title} ↗
            </a>
          ) : (
            <span style={{ fontWeight: 700 }}>{resume.title}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <Link href="/review" style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{due}</div>
          <div style={{ color: "var(--muted)" }}>due for review</div>
        </Link>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{solved}</div>
          <div style={{ color: "var(--muted)" }}>problems solved</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {patterns.started}/{patterns.total}
          </div>
          <div style={{ color: "var(--muted)" }}>patterns started</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Link href="/patterns" style={{ ...card, display: "inline-block", flex: "none" }}>
          Study a pattern →
        </Link>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Due today</div>
      {dueItems.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nothing due — you're all caught up.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dueItems.map((item) => (
            <Link
              key={`${item.item_type}:${item.item_id}`}
              href="/review"
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
            >
              <span>{item.title}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{item.item_type}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1`
Seed an attempt + a due review for realistic data:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');db.prepare(\"INSERT INTO attempts (problem_id,outcome,rating,date) VALUES (1,'solved','ok',datetime('now'))\").run();db.prepare(\"UPDATE problems SET status='solved' WHERE id=1\").run();db.prepare(\"INSERT OR IGNORE INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('problem',1,2.5,1,date('now'),date('now'))\").run();console.log('seeded')})"`
Run `npm run dev`, load `http://localhost:3000/`.
Expected: "Today" with a streak line; a resume card for the attempted problem; stats showing due ≥ 1, solved = 1, patterns started count; a "Study a pattern →" link; and a "Due today" list with the problem linking to `/review`. Stop the dev server.

- [ ] **Step 3: Type-check and full suite**

Run: `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0), then `npm test` (expect all pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/page.tsx"
git commit -m "feat: add Today screen with stats and due items"
```

---

## Definition of Done (Phase 3)

- Rating a problem attempt (in the log popover) schedules that problem's next review via SM-2.
- A pattern can be reviewed from its page (Hard/OK/Easy), scheduling the pattern independently.
- `/review` lists everything due (problems + patterns), and rating an item reschedules it off the list.
- `/` (Today) shows date + streak, a resume card, stats (due / solved / patterns started), a "study a pattern" link, and the due list linking to the queue.
- Rating buttons never display the resulting interval.
- `npm test` passes (Phase 0–2 tests + new SM-2/dates/reviews/stats tests); `tsc --noEmit` is clean.
- Deferred to Phase 5: activity heatmap, weakest-retention suggestion.

## Self-Review Notes

- **Spec coverage:** SM-2 scheduling (§5) ✓ Tasks 1–2; both problems and patterns reviewable with independent schedules (§5) ✓ Tasks 2/4/5; due queue + Review queue flow (§8.4) ✓ Task 6; Today screen with resume, quick-study, stats, due list (§8.1, §11 Phase 3) ✓ Task 7; "don't surface SRS intervals on rating controls" (§9, user pref) ✓ — buttons show only Hard/OK/Easy. Heatmap + weakest-retention explicitly deferred to Phase 5 per §11.
- **No new schema:** the `reviews` table from `0001_init.sql` already has every needed column + `UNIQUE(item_type, item_id)` for the upsert.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `ReviewState`, `Rating`, `nextReview`, `addDays`, `todayIso`, `ItemType`, `DueItem`, `getReviewState`, `recordReview`, `getDueItems`, `dueCount`, `solvedCount`, `patternsProgress`, `currentStreak`, `ResumeProblem`, `lastAttemptedProblem`, `recordReviewAction`, `recordPatternReviewAction` are consistent across tasks. `recordReviewAction` reads `itemType`/`itemId`/`rating`/`revalidate` matching the Review-queue form's hidden inputs; `recordPatternReviewAction` reads `patternId`/`slug`/`rating` matching the pattern-page form.
- **Reuse:** `Rating` is the same union used by Phase 2's attempts; both `lib/srs/sm2.ts` and `lib/db/attempts.ts` define a `Rating` union with identical members — the reviews/actions layer imports the SM-2 one. (They are structurally identical string unions, so assignment between them type-checks.)
