# DSA Trainer — Phase 5 (Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round out the app with the activity heatmap and a weakest-retention "study" suggestion on the Today screen, plus a dedicated Stats screen.

**Architecture:** A small activity data helper counts attempts per day; a pure grid builder turns that into a fixed 13-week chronological cell array; a presentational `Heatmap` component renders it. A `weakestPattern` helper ranks patterns by review ease and feeds the Today "study a pattern" suggestion. A `statsPage` data module (solved-by-difficulty, total attempts, per-pattern mastery) backs a new Stats page. All new query helpers follow the existing data-helper convention; pages are server components.

**Tech Stack:** Next.js (App Router, TS), better-sqlite3, Vitest + Testing Library.

## Global Constraints

- Runs locally via `npm run dev` on localhost:3000. Single user, no auth.
- TypeScript everywhere; App Router; DB access server-side only; `better-sqlite3` never imported into a client component.
- No face emojis in UI; plain text labels. Inline styles with CSS variables (`var(--border)`, `var(--muted)`, `var(--fg)`, `var(--accent)`, `var(--panel)`).
- Dates are `YYYY-MM-DD` strings; reuse `addDays`/`todayIso` (lib/srs/dates.ts).
- Heatmap: **13 weeks** (91 days) ending today; a day's "activity" = the number of `attempts` logged that day (reviews are not counted in v1).
- Weakest-retention: the pattern whose `reviews` row (`item_type='pattern'`) has the **lowest `ease`**, ties broken by earliest `due_date`; if no pattern has been reviewed, fall back to the first pattern by `ordering, name`; `null` only when there are no patterns. Do not surface ease/interval numbers on the Today suggestion (it just names the pattern).
- Reuse existing helpers: `getDb()`, `dueCount`/`solvedCount`/`patternsProgress`/`currentStreak`/`lastAttemptedProblem` (lib/db/stats.ts), `getDueItems` (lib/db/reviews.ts). All SQL parameterized.

---

## File Structure

- `lib/db/activity.ts` — `attemptCountsByDay(db, sinceDay)`.
- `lib/db/activity.test.ts` — unit tests.
- `lib/heatmap/grid.ts` — `HeatCell`, `buildHeatmap(counts, endDay, weeks)` (pure).
- `lib/heatmap/grid.test.ts` — unit tests.
- `components/Heatmap.tsx` — presentational grid renderer.
- `components/Heatmap.test.tsx` — component test.
- `lib/db/weakest.ts` — `WeakPattern`, `weakestPattern(db)`.
- `lib/db/weakest.test.ts` — unit tests.
- `lib/db/statsPage.ts` — `solvedByDifficulty`, `totalAttempts`, `patternMastery` + types.
- `lib/db/statsPage.test.ts` — unit tests.
- `app/(shell)/page.tsx` — add the heatmap + weakest-retention suggestion (modify).
- `app/(shell)/stats/page.tsx` — the Stats screen (replace placeholder).

---

## Task 1: Activity data helper (TDD)

**Files:**
- Create: `lib/db/activity.ts`, `lib/db/activity.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create the `attempts` table inline.
- Produces: `attemptCountsByDay(db, sinceDay: string): Record<string, number>` — a map from `YYYY-MM-DD` to the number of attempts logged that day, for days on or after `sinceDay`.

- [ ] **Step 1: Write the failing test**

`lib/db/activity.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { attemptCountsByDay } from "./activity";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL,
       date TEXT NOT NULL, outcome TEXT NOT NULL DEFAULT 'solved');`
  );
  const ins = db.prepare("INSERT INTO attempts (problem_id, date) VALUES (1, ?)");
  ins.run("2026-06-24 09:00:00");
  ins.run("2026-06-24 18:00:00");
  ins.run("2026-06-22 10:00:00");
  ins.run("2026-06-10 10:00:00"); // before sinceDay
});

describe("attemptCountsByDay", () => {
  it("counts attempts per day from sinceDay onward", () => {
    expect(attemptCountsByDay(db, "2026-06-20")).toEqual({
      "2026-06-22": 1,
      "2026-06-24": 2,
    });
  });

  it("returns an empty map when nothing is in range", () => {
    expect(attemptCountsByDay(db, "2026-07-01")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/activity.test.ts`
Expected: FAIL — cannot find `./activity`.

- [ ] **Step 3: Implement the helper**

`lib/db/activity.ts`:
```ts
import type Database from "better-sqlite3";

export function attemptCountsByDay(
  db: Database.Database,
  sinceDay: string
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT date(date) AS day, COUNT(*) AS count
         FROM attempts
        WHERE date(date) >= ?
        GROUP BY day`
    )
    .all(sinceDay) as { day: string; count: number }[];
  const map: Record<string, number> = {};
  for (const r of rows) map[r.day] = r.count;
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/activity.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/activity.ts lib/db/activity.test.ts
git commit -m "feat: add attempt-counts-by-day activity helper"
```

---

## Task 2: Heatmap grid builder (TDD)

**Files:**
- Create: `lib/heatmap/grid.ts`, `lib/heatmap/grid.test.ts`

**Interfaces:**
- Consumes: `addDays` (lib/srs/dates.ts).
- Produces:
  - `interface HeatCell { day: string; count: number }`
  - `buildHeatmap(counts: Record<string, number>, endDay: string, weeks: number): HeatCell[]` — returns `weeks * 7` cells in chronological order, the last cell being `endDay`; each cell's `count` is `counts[day] ?? 0`.

- [ ] **Step 1: Write the failing tests**

`lib/heatmap/grid.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildHeatmap } from "./grid";

describe("buildHeatmap", () => {
  it("returns weeks*7 chronological cells ending at endDay", () => {
    const cells = buildHeatmap(
      { "2026-06-24": 3, "2026-06-23": 1 },
      "2026-06-24",
      2
    );
    expect(cells).toHaveLength(14);
    expect(cells[13]).toEqual({ day: "2026-06-24", count: 3 });
    expect(cells[12]).toEqual({ day: "2026-06-23", count: 1 });
    expect(cells[0]).toEqual({ day: "2026-06-11", count: 0 });
  });

  it("defaults missing days to zero", () => {
    const cells = buildHeatmap({}, "2026-06-24", 1);
    expect(cells).toHaveLength(7);
    expect(cells.every((c) => c.count === 0)).toBe(true);
    expect(cells[6].day).toBe("2026-06-24");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/heatmap/grid.test.ts`
Expected: FAIL — cannot find `./grid`.

- [ ] **Step 3: Implement the builder**

`lib/heatmap/grid.ts`:
```ts
import { addDays } from "@/lib/srs/dates";

export interface HeatCell {
  day: string;
  count: number;
}

export function buildHeatmap(
  counts: Record<string, number>,
  endDay: string,
  weeks: number
): HeatCell[] {
  const total = weeks * 7;
  const firstDay = addDays(endDay, -(total - 1));
  const cells: HeatCell[] = [];
  for (let i = 0; i < total; i++) {
    const day = addDays(firstDay, i);
    cells.push({ day, count: counts[day] ?? 0 });
  }
  return cells;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/heatmap/grid.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/heatmap/grid.ts lib/heatmap/grid.test.ts
git commit -m "feat: add heatmap grid builder"
```

---

## Task 3: Heatmap component (TDD)

**Files:**
- Create: `components/Heatmap.tsx`, `components/Heatmap.test.tsx`

**Interfaces:**
- Consumes: `HeatCell` (type, from `@/lib/heatmap/grid`).
- Produces:
  - `interface HeatmapProps { cells: HeatCell[] }`
  - `Heatmap({ cells }): JSX.Element` — renders the cells as a 7-row, column-first grid (each column is a week, days top to bottom), colouring each cell by an intensity bucket of its `count` (0 / 1 / 2–3 / 4+). Each cell carries a `data-count` attribute and a `title` of `"<day>: <count>"`. Plain React component (no `"use client"`, no db import).

- [ ] **Step 1: Write the failing component test**

`components/Heatmap.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Heatmap } from "./Heatmap";

describe("Heatmap", () => {
  it("renders one element per cell with its count", () => {
    const { container } = render(
      <Heatmap
        cells={[
          { day: "2026-06-23", count: 0 },
          { day: "2026-06-24", count: 5 },
        ]}
      />
    );
    const nodes = container.querySelectorAll("[data-count]");
    expect(nodes).toHaveLength(2);
    const busy = container.querySelector('[data-count="5"]');
    expect(busy).not.toBeNull();
    expect(busy!.getAttribute("title")).toContain("2026-06-24");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/Heatmap.test.tsx`
Expected: FAIL — cannot find `./Heatmap`.

- [ ] **Step 3: Implement the component**

`components/Heatmap.tsx`:
```tsx
import type { HeatCell } from "@/lib/heatmap/grid";

export interface HeatmapProps {
  cells: HeatCell[];
}

function cellColor(count: number): string {
  if (count <= 0) return "var(--panel)";
  if (count === 1) return "rgba(16,185,129,0.30)";
  if (count <= 3) return "rgba(16,185,129,0.55)";
  return "rgba(16,185,129,0.85)";
}

export function Heatmap({ cells }: HeatmapProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "repeat(7, 11px)",
        gridAutoFlow: "column",
        gap: 3,
      }}
    >
      {cells.map((c) => (
        <div
          key={c.day}
          data-count={c.count}
          title={`${c.day}: ${c.count}`}
          style={{
            width: 11,
            height: 11,
            borderRadius: 2,
            background: cellColor(c.count),
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/Heatmap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add components/Heatmap.tsx components/Heatmap.test.tsx
git commit -m "feat: add Heatmap presentational component"
```

---

## Task 4: Weakest-retention helper (TDD)

**Files:**
- Create: `lib/db/weakest.ts`, `lib/db/weakest.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create `patterns` and `reviews` inline.
- Produces:
  - `interface WeakPattern { id: number; name: string; slug: string }`
  - `weakestPattern(db): WeakPattern | null` — the pattern whose `reviews` row (`item_type='pattern'`) has the lowest `ease` (ties → earliest `due_date`); if no pattern has been reviewed, the first pattern by `ordering, name`; `null` when there are no patterns.

- [ ] **Step 1: Write the failing tests**

`lib/db/weakest.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { weakestPattern } from "./weakest";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
      ordering INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL NOT NULL DEFAULT 2.5, due_date TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (1,'Sliding Window','sliding-window',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (2,'Binary Search','binary-search',2)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (3,'Graphs','graphs',3)").run();
});

describe("weakestPattern", () => {
  it("returns the reviewed pattern with the lowest ease", () => {
    db.prepare("INSERT INTO reviews (item_type,item_id,ease,due_date) VALUES ('pattern',1,2.5,'2026-06-30')").run();
    db.prepare("INSERT INTO reviews (item_type,item_id,ease,due_date) VALUES ('pattern',2,1.8,'2026-06-28')").run();
    expect(weakestPattern(db)).toEqual({ id: 2, name: "Binary Search", slug: "binary-search" });
  });

  it("falls back to the first pattern by ordering when none reviewed", () => {
    expect(weakestPattern(db)).toEqual({ id: 1, name: "Sliding Window", slug: "sliding-window" });
  });

  it("returns null when there are no patterns", () => {
    db.exec("DELETE FROM patterns");
    expect(weakestPattern(db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/weakest.test.ts`
Expected: FAIL — cannot find `./weakest`.

- [ ] **Step 3: Implement the helper**

`lib/db/weakest.ts`:
```ts
import type Database from "better-sqlite3";

export interface WeakPattern {
  id: number;
  name: string;
  slug: string;
}

export function weakestPattern(db: Database.Database): WeakPattern | null {
  const reviewed = db
    .prepare(
      `SELECT pa.id, pa.name, pa.slug
         FROM reviews r JOIN patterns pa ON pa.id = r.item_id
        WHERE r.item_type = 'pattern'
        ORDER BY r.ease ASC, r.due_date ASC
        LIMIT 1`
    )
    .get() as WeakPattern | undefined;
  if (reviewed) return reviewed;

  const fallback = db
    .prepare("SELECT id, name, slug FROM patterns ORDER BY ordering, name LIMIT 1")
    .get() as WeakPattern | undefined;
  return fallback ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/weakest.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/weakest.ts lib/db/weakest.test.ts
git commit -m "feat: add weakest-retention pattern helper"
```

---

## Task 5: Add the heatmap + weakest-retention suggestion to Today

**Files:**
- Modify: `app/(shell)/page.tsx`

**Interfaces:**
- Consumes: `attemptCountsByDay` (Task 1), `buildHeatmap` (Task 2), `Heatmap` (Task 3), `weakestPattern` (Task 4), `addDays`/`todayIso` (lib/srs/dates.ts).
- Produces: an "Activity" section with the 13-week heatmap, and a "Study a pattern" link that names the weakest-retention pattern (linking to `/patterns/<slug>`), or the plain `/patterns` link when there are no patterns.

- [ ] **Step 1: Read the current file**

Run: `cat "app/(shell)/page.tsx"`
Identify the imports, the `const today = todayIso();` line, the existing "Study a pattern →" `Link` (to `/patterns`), and the closing `</main>`.

- [ ] **Step 2: Add the imports**

Add alongside the existing imports in `app/(shell)/page.tsx`:
```tsx
import { addDays } from "@/lib/srs/dates";
import { attemptCountsByDay } from "@/lib/db/activity";
import { buildHeatmap } from "@/lib/heatmap/grid";
import { Heatmap } from "@/components/Heatmap";
import { weakestPattern } from "@/lib/db/weakest";
```
(`todayIso` is already imported — do not duplicate it.)

- [ ] **Step 3: Compute the heatmap cells and weakest pattern**

After the existing `const dueItems = getDueItems(db, today).slice(0, 5);` line, add:
```tsx
  const heatmapCells = buildHeatmap(
    attemptCountsByDay(db, addDays(today, -90)),
    today,
    13
  );
  const weakest = weakestPattern(db);
```

- [ ] **Step 4: Make the "Study a pattern" link use the suggestion**

Replace the existing study-pattern block:
```tsx
      <div style={{ marginBottom: 18 }}>
        <Link href="/patterns" style={{ ...card, display: "inline-block", flex: "none" }}>
          Study a pattern →
        </Link>
      </div>
```
with:
```tsx
      <div style={{ marginBottom: 18 }}>
        <Link
          href={weakest ? `/patterns/${weakest.slug}` : "/patterns"}
          style={{ ...card, display: "inline-block", flex: "none" }}
        >
          Study a pattern →
          {weakest && (
            <span style={{ color: "var(--muted)", fontWeight: 400 }}> {weakest.name}</span>
          )}
        </Link>
      </div>
```

- [ ] **Step 5: Render the heatmap before the closing `</main>`**

Immediately before the closing `</main>` tag, add:
```tsx
      <div style={{ marginTop: 24, fontWeight: 700, marginBottom: 8 }}>Activity</div>
      <Heatmap cells={heatmapCells} />
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1`
Seed some activity:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');db.prepare(\"INSERT INTO attempts (problem_id,outcome,rating,date) VALUES (1,'solved','ok',datetime('now'))\").run();db.prepare(\"INSERT OR IGNORE INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',2,1.7,3,date('now','+3 day'),date('now'))\").run();console.log('seeded')})"`
Run `npm run dev`, load `http://localhost:3000/`.
Expected: an "Activity" heatmap grid is visible (with at least one coloured cell for today), and the "Study a pattern →" link names "Binary Search" (the lowest-ease reviewed pattern) and points to `/patterns/binary-search`. Stop the dev server.

- [ ] **Step 7: Type-check and full suite**

Run: `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0), then `npm test` (expect all pass).

- [ ] **Step 8: Commit**

```bash
git add "app/(shell)/page.tsx"
git commit -m "feat: add activity heatmap and weakest-retention suggestion to Today"
```

---

## Task 6: Stats data helpers (TDD)

**Files:**
- Create: `lib/db/statsPage.ts`, `lib/db/statsPage.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create `problems`, `patterns`, `reviews`, `attempts` inline.
- Produces:
  - `interface DifficultyCount { difficulty: string; solved: number }`
  - `solvedByDifficulty(db): DifficultyCount[]` — counts of `status='solved'` problems grouped by difficulty, ordered by difficulty.
  - `totalAttempts(db): number` — total rows in `attempts`.
  - `interface PatternMastery { name: string; slug: string; status: string; ease: number | null; interval_days: number | null }`
  - `patternMastery(db): PatternMastery[]` — every pattern with its `pattern` review's `ease`/`interval_days` (null when never reviewed), ordered by `ordering, name`.

- [ ] **Step 1: Write the failing tests**

`lib/db/statsPage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { solvedByDifficulty, totalAttempts, patternMastery } from "./statsPage";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL, difficulty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started', ordering INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT NOT NULL, item_id INTEGER NOT NULL,
      ease REAL, interval_days INTEGER);
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER NOT NULL, date TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('A','Easy','solved')").run();
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('B','Medium','solved')").run();
  db.prepare("INSERT INTO problems (title,difficulty,status) VALUES ('C','Medium','solving')").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO reviews (item_type,item_id,ease,interval_days) VALUES ('pattern',1,2.3,8)").run();
  db.prepare("INSERT INTO attempts (problem_id) VALUES (1)").run();
  db.prepare("INSERT INTO attempts (problem_id) VALUES (1)").run();
});

describe("solvedByDifficulty", () => {
  it("counts solved problems per difficulty", () => {
    expect(solvedByDifficulty(db)).toEqual([
      { difficulty: "Easy", solved: 1 },
      { difficulty: "Medium", solved: 1 },
    ]);
  });
});

describe("totalAttempts", () => {
  it("counts all attempts", () => {
    expect(totalAttempts(db)).toBe(2);
  });
});

describe("patternMastery", () => {
  it("lists patterns with review ease/interval or null", () => {
    expect(patternMastery(db)).toEqual([
      { name: "Sliding Window", slug: "sliding-window", status: "learning", ease: 2.3, interval_days: 8 },
      { name: "Binary Search", slug: "binary-search", status: "not_started", ease: null, interval_days: null },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/statsPage.test.ts`
Expected: FAIL — cannot find `./statsPage`.

- [ ] **Step 3: Implement the helpers**

`lib/db/statsPage.ts`:
```ts
import type Database from "better-sqlite3";

export interface DifficultyCount {
  difficulty: string;
  solved: number;
}

export function solvedByDifficulty(db: Database.Database): DifficultyCount[] {
  return db
    .prepare(
      `SELECT difficulty, COUNT(*) AS solved
         FROM problems WHERE status = 'solved'
        GROUP BY difficulty ORDER BY difficulty`
    )
    .all() as DifficultyCount[];
}

export function totalAttempts(db: Database.Database): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM attempts").get() as { c: number }
  ).c;
}

export interface PatternMastery {
  name: string;
  slug: string;
  status: string;
  ease: number | null;
  interval_days: number | null;
}

export function patternMastery(db: Database.Database): PatternMastery[] {
  return db
    .prepare(
      `SELECT pa.name, pa.slug, pa.status, r.ease AS ease, r.interval_days AS interval_days
         FROM patterns pa
         LEFT JOIN reviews r ON r.item_type = 'pattern' AND r.item_id = pa.id
        ORDER BY pa.ordering, pa.name`
    )
    .all() as PatternMastery[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/statsPage.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/statsPage.ts lib/db/statsPage.test.ts
git commit -m "feat: add stats-page data helpers"
```

---

## Task 7: Stats screen

**Files:**
- Modify: `app/(shell)/stats/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getDb()`, `solvedByDifficulty`/`totalAttempts`/`patternMastery` (Task 6), `solvedCount`/`patternsProgress`/`dueCount`/`currentStreak` (lib/db/stats.ts), `todayIso` (lib/srs/dates.ts).
- Produces: the Stats screen at `/stats` — summary cards (solved / attempts / due / streak / patterns started), a "Solved by difficulty" line, and a "Pattern mastery" table.

- [ ] **Step 1: Implement the page**

`app/(shell)/stats/page.tsx`:
```tsx
import { getDb } from "@/lib/db/connection";
import { todayIso } from "@/lib/srs/dates";
import {
  solvedCount,
  patternsProgress,
  dueCount,
  currentStreak,
} from "@/lib/db/stats";
import {
  solvedByDifficulty,
  totalAttempts,
  patternMastery,
} from "@/lib/db/statsPage";

export const dynamic = "force-dynamic";

const card = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 14px",
} as const;

export default function StatsPage() {
  const db = getDb();
  const today = todayIso();
  const solved = solvedCount(db);
  const attempts = totalAttempts(db);
  const due = dueCount(db, today);
  const streak = currentStreak(db, today);
  const patterns = patternsProgress(db);
  const byDifficulty = solvedByDifficulty(db);
  const mastery = patternMastery(db);

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Stats</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{solved}</div>
          <div style={{ color: "var(--muted)" }}>problems solved</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{attempts}</div>
          <div style={{ color: "var(--muted)" }}>attempts logged</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{due}</div>
          <div style={{ color: "var(--muted)" }}>due for review</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{streak}</div>
          <div style={{ color: "var(--muted)" }}>day streak</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {patterns.started}/{patterns.total}
          </div>
          <div style={{ color: "var(--muted)" }}>patterns started</div>
        </div>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Solved by difficulty</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 22, color: "var(--muted)" }}>
        {byDifficulty.length === 0 ? (
          <span>No solved problems yet.</span>
        ) : (
          byDifficulty.map((d) => (
            <span key={d.difficulty}>
              {d.difficulty}: <span style={{ color: "var(--fg)", fontWeight: 600 }}>{d.solved}</span>
            </span>
          ))
        )}
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Pattern mastery</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", padding: "0 10px" }}>
          <span>Pattern</span><span>Status</span><span>Ease</span><span>Interval</span>
        </div>
        {mastery.map((m) => (
          <a
            key={m.slug}
            href={`/patterns/${m.slug}`}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            <span style={{ fontWeight: 600 }}>{m.name}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{m.status.replace("_", " ")}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{m.ease ?? "—"}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {m.interval_days != null ? `${m.interval_days}d` : "—"}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1`
Seed some data:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');db.prepare(\"UPDATE problems SET status='solved' WHERE lc_slug='koko-eating-bananas'\").run();db.prepare(\"INSERT INTO attempts (problem_id,outcome,rating,date) VALUES (2,'solved','ok',datetime('now'))\").run();db.prepare(\"INSERT OR IGNORE INTO reviews (item_type,item_id,ease,interval_days,due_date,last_reviewed) VALUES ('pattern',1,2.3,8,date('now','+8 day'),date('now'))\").run();console.log('seeded')})"`
Run `npm run dev`, load `http://localhost:3000/stats`.
Expected: summary cards (solved ≥ 1, attempts ≥ 1, etc.), a "Solved by difficulty" line (e.g. "Medium: 1"), and a "Pattern mastery" table listing the three seeded patterns with Sliding Window showing ease 2.3 / interval 8d and the others showing "—". Stop the dev server.

- [ ] **Step 3: Type-check and full suite**

Run: `node node_modules/typescript/bin/tsc --noEmit` (expect exit 0), then `npm test` (expect all pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/stats/page.tsx"
git commit -m "feat: add stats screen"
```

---

## Definition of Done (Phase 5)

- The Today screen shows a 13-week activity heatmap (attempts per day) and a "study a pattern" link that names the weakest-retention pattern.
- `/stats` shows summary cards, a solved-by-difficulty breakdown, and a per-pattern mastery table (ease/interval or "—").
- `npm test` passes (all prior tests + new activity/grid/heatmap/weakest/statsPage tests); `tsc --noEmit` is clean.
- Still deferred (not part of this plan): streaming tutor, problem-scoped tutor, teach-it-back → SRS, the two-column right-panel layout, and authoring the real deep per-pattern content.

## Self-Review Notes

- **Spec coverage:** activity heatmap (§8.1, §11 Phase 5) ✓ Tasks 1–3, 5; weakest-retention suggestion (§5, §8.1, §11 Phase 5) ✓ Tasks 4–5; Stats screen (§8.5, §11 Phase 5) ✓ Tasks 6–7. "Refinements" is satisfied by these three polish items; nothing else in the spec is unimplemented after this phase except the explicitly-deferred niceties.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `attemptCountsByDay`, `HeatCell`/`buildHeatmap`, `HeatmapProps`/`Heatmap`, `WeakPattern`/`weakestPattern`, `DifficultyCount`/`solvedByDifficulty`, `totalAttempts`, `PatternMastery`/`patternMastery` are consistent across tasks. `buildHeatmap` returns `HeatCell[]` which `Heatmap` consumes; the Today page composes `attemptCountsByDay` → `buildHeatmap` → `Heatmap` with matching shapes; `patternMastery` uses `interval_days` (snake) consistently in the type and the Stats page.
- **No new schema:** all data comes from existing tables (`attempts`, `reviews`, `patterns`, `problems`).
