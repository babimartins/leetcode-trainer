# DSA Trainer — Phase 1 (Content & Reading) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the skeleton into a readable study app — a patterns list, a per-pattern reading page that renders Markdown study content with syntax-highlighted code, and section-level inline notes you can add and delete.

**Architecture:** Study content lives as Markdown files at `content/patterns/<slug>.md`. A pure `splitSections` utility breaks a file into sections by its `##` headings; each section's stable key is the slugified heading text. The pattern detail page (a server component) loads the pattern row from SQLite, reads its Markdown, splits it, renders each section body with a reusable `MarkdownView` (react-markdown), and interleaves that section's notes plus an add-note form. Notes are persisted to the existing `notes` table via server actions, keyed by `(pattern_id, section_key)`.

**Tech Stack:** Next.js (App Router, TS), better-sqlite3, `react-markdown` + `remark-gfm` + `rehype-highlight` (+ `highlight.js` theme CSS), Vitest + Testing Library.

## Global Constraints

- Runs locally via `npm run dev` on localhost:3000. Single user, no auth.
- TypeScript everywhere. App Router (`app/`), not Pages Router.
- All database access is server-side only; `better-sqlite3` is never imported into a client component.
- SQLite db at `data/dsa.sqlite` (gitignored). Study content at `content/patterns/<slug>.md` (committed).
- No face emojis in UI. Plain text labels on controls.
- Section-level note anchoring: a note stores `(pattern_id, section_key, body)` where `section_key` is the slugified heading text. Notes never anchor to character offsets.
- Phase 1 ships **minimal sample/placeholder** content only — enough to exercise rendering, sections, and notes. Writing the real deep guides is a separate authoring track, not part of this plan.
- Reuse existing helpers: `getDb()` (`lib/db/connection.ts`), `getAppState`/`setAppState` (`lib/db/appState.ts`). Follow the Phase 0 server-action pattern (see `lib/settings/actions.ts`) and inline-style + CSS-variable conventions.

---

## File Structure

- `components/MarkdownView.tsx` — renders a Markdown string to React (gfm + highlight). Reusable.
- `components/MarkdownView.test.tsx` — component test.
- `lib/content/sections.ts` — `slugify` + `splitSections` pure utilities.
- `lib/content/sections.test.ts` — unit tests for the above.
- `lib/content/loadPattern.ts` — reads a pattern's Markdown file from disk.
- `lib/content/loadPattern.test.ts` — unit test.
- `content/patterns/sliding-window.md`, `binary-search.md`, `graphs-bfs-dfs.md` — sample content.
- `lib/db/patterns.ts` — `listPatterns` / `getPatternBySlug`.
- `lib/db/patterns.test.ts` — unit tests.
- `lib/db/notes.ts` — `listNotesForPattern` / `addNote` / `deleteNote`.
- `lib/db/notes.test.ts` — unit tests.
- `lib/db/problemsForPattern.ts` — `listProblemsForPattern` (read-only).
- `lib/db/problemsForPattern.test.ts` — unit test.
- `lib/notes/actions.ts` — `addNoteAction` / `deleteNoteAction` server actions.
- `app/(shell)/patterns/page.tsx` — patterns list (replaces the placeholder).
- `app/(shell)/patterns/[slug]/page.tsx` — pattern detail reading page.
- `app/globals.css` — add `.markdown` styles; import highlight theme in the root layout.
- `app/layout.tsx` — import the highlight.js theme CSS (modify).

---

## Task 1: MarkdownView component + highlight styling

**Files:**
- Create: `components/MarkdownView.tsx`, `components/MarkdownView.test.tsx`
- Modify: `package.json` (add deps), `app/layout.tsx` (import highlight theme), `app/globals.css` (markdown styles)

**Interfaces:**
- Produces: `MarkdownView({ markdown }: { markdown: string })` — a React component rendering Markdown (GitHub-flavored) with syntax-highlighted fenced code. No CSS import inside the component (keeps it test-friendly); the highlight theme is imported once in the root layout.

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install react-markdown@^9.0.1 remark-gfm@^4.0.0 rehype-highlight@^7.0.1 highlight.js@^11.10.0
```
Expected: packages added, `npm install` exits 0.

- [ ] **Step 2: Write the failing component test**

`components/MarkdownView.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("renders headings, list items, and fenced code", () => {
    const md = [
      "## Intuition",
      "",
      "Slide a window over the array.",
      "",
      "- first point",
      "- second point",
      "",
      "```python",
      "def slide(s):",
      "    return s",
      "```",
    ].join("\n");

    render(<MarkdownView markdown={md} />);

    expect(
      screen.getByRole("heading", { name: "Intuition" })
    ).toBeInTheDocument();
    expect(screen.getByText("first point")).toBeInTheDocument();
    expect(screen.getByText(/def slide/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/MarkdownView.test.tsx`
Expected: FAIL — cannot find `./MarkdownView`.

- [ ] **Step 4: Implement MarkdownView**

`components/MarkdownView.tsx`:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/MarkdownView.test.tsx`
Expected: PASS (3 assertions).

- [ ] **Step 6: Import the highlight theme and add markdown styles**

In `app/layout.tsx`, add this import directly below the existing `import "./globals.css";` line:
```tsx
import "highlight.js/styles/github-dark.css";
```

Append to `app/globals.css`:
```css
.markdown { line-height: 1.6; }
.markdown h2 { font-size: 18px; margin: 22px 0 8px; }
.markdown p { color: var(--fg); }
.markdown ul { padding-left: 18px; }
.markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px; }
.markdown pre { background: var(--panel); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 14px; overflow: auto; }
.markdown pre code { background: transparent; padding: 0; }
```

- [ ] **Step 7: Verify the full suite still passes**

Run: `npm test`
Expected: all suites pass (Phase 0 tests + the new one).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json components/MarkdownView.tsx components/MarkdownView.test.tsx app/layout.tsx app/globals.css
git commit -m "feat: add MarkdownView renderer with syntax highlighting"
```

---

## Task 2: Section splitting + slugify utilities (TDD)

**Files:**
- Create: `lib/content/sections.ts`, `lib/content/sections.test.ts`

**Interfaces:**
- Produces:
  - `slugify(text: string): string` — lowercase, non-alphanumeric runs → single `-`, trimmed of leading/trailing `-`.
  - `interface Section { key: string; title: string; body: string }`
  - `splitSections(markdown: string): Section[]` — splits on `##` headings. Each heading becomes a section whose `title` is the heading text, `key` is `slugify(title)`, and `body` is the Markdown between this heading and the next (heading line excluded, trimmed). Any content before the first `##` becomes a leading section `{ key: "overview", title: "Overview", body }` (omitted if that content is empty/whitespace).

- [ ] **Step 1: Write the failing tests**

`lib/content/sections.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { slugify, splitSections } from "./sections";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("When to reach for it")).toBe("when-to-reach-for-it");
  });
  it("collapses non-alphanumeric runs and trims hyphens", () => {
    expect(slugify("Graphs / BFS · DFS!")).toBe("graphs-bfs-dfs");
  });
});

describe("splitSections", () => {
  it("splits on ## headings with slugified keys and trimmed bodies", () => {
    const md = [
      "## Intuition",
      "",
      "Slide a window.",
      "",
      "## Common pitfalls",
      "",
      "- forgetting to shrink",
    ].join("\n");

    const sections = splitSections(md);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({
      key: "intuition",
      title: "Intuition",
      body: "Slide a window.",
    });
    expect(sections[1]).toEqual({
      key: "common-pitfalls",
      title: "Common pitfalls",
      body: "- forgetting to shrink",
    });
  });

  it("captures content before the first heading as an Overview section", () => {
    const md = ["Intro line.", "", "## Intuition", "", "Body."].join("\n");
    const sections = splitSections(md);
    expect(sections[0]).toEqual({
      key: "overview",
      title: "Overview",
      body: "Intro line.",
    });
    expect(sections[1].key).toBe("intuition");
  });

  it("returns an empty array for empty input", () => {
    expect(splitSections("   \n  ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/content/sections.test.ts`
Expected: FAIL — cannot find `./sections`.

- [ ] **Step 3: Implement the utilities**

`lib/content/sections.ts`:
```ts
export interface Section {
  key: string;
  title: string;
  body: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { title: string; bodyLines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({
        key: slugify(current.title),
        title: current.title,
        body: current.bodyLines.join("\n").trim(),
      });
      current = null;
    }
  };

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = { title: heading[1], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  const pre = preamble.join("\n").trim();
  if (pre) {
    sections.unshift({ key: "overview", title: "Overview", body: pre });
  }
  return sections;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/content/sections.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/content/sections.ts lib/content/sections.test.ts
git commit -m "feat: add section splitting and slugify utilities"
```

---

## Task 3: Sample content files + content loader (TDD)

**Files:**
- Create: `lib/content/loadPattern.ts`, `lib/content/loadPattern.test.ts`, `content/patterns/sliding-window.md`, `content/patterns/binary-search.md`, `content/patterns/graphs-bfs-dfs.md`

**Interfaces:**
- Produces: `loadPatternContent(slug: string, baseDir?: string): string | null` — returns the Markdown text of `<baseDir>/<slug>.md`, or `null` if the file does not exist. `baseDir` defaults to `path.join(process.cwd(), "content", "patterns")`.

- [ ] **Step 1: Write the failing test**

`lib/content/loadPattern.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPatternContent } from "./loadPattern";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("loadPatternContent", () => {
  it("returns file contents for an existing slug", () => {
    fs.writeFileSync(path.join(dir, "sliding-window.md"), "## Intuition\n\nHi.");
    expect(loadPatternContent("sliding-window", dir)).toBe("## Intuition\n\nHi.");
  });

  it("returns null for a missing slug", () => {
    expect(loadPatternContent("nope", dir)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/content/loadPattern.test.ts`
Expected: FAIL — cannot find `./loadPattern`.

- [ ] **Step 3: Implement the loader**

`lib/content/loadPattern.ts`:
```ts
import fs from "node:fs";
import path from "node:path";

export function loadPatternContent(
  slug: string,
  baseDir: string = path.join(process.cwd(), "content", "patterns")
): string | null {
  const file = path.join(baseDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/content/loadPattern.test.ts`
Expected: both PASS.

- [ ] **Step 5: Create the sample content files**

`content/patterns/sliding-window.md`:
```markdown
## Intuition

Maintain a contiguous window over the sequence and slide it instead of
recomputing from scratch. Each element enters and leaves the window at most
once, so the whole scan is linear time.

## When to reach for it

- "longest / shortest / max / min **contiguous** subarray or substring…"
- a window constraint you can grow and shrink (sum ≤ k, at most K distinct
  characters, no repeats)
- brute force is O(n·k) and recomputes overlapping work

## Template

```python
def slide(s):
    left = 0
    best = 0
    for right in range(len(s)):
        # add s[right] to the window
        while window_is_invalid():
            # remove s[left] from the window
            left += 1
        best = max(best, right - left + 1)
    return best
```

## Complexity

- Time: O(n) — each index is added and removed at most once.
- Space: O(k) — proportional to the window's contents.

## Common pitfalls

- Forgetting to shrink the window, which silently turns the scan into O(n²).
- Updating the answer before the window is valid again.
- Off-by-one when the window size is fixed vs. variable.

> Sample content — replace with your own deep notes over time.
```

`content/patterns/binary-search.md`:
```markdown
## Intuition

Repeatedly halve a sorted search space by comparing against the middle. The key
generalization for interviews is **binary search on the answer**: search over a
range of possible answers and test feasibility.

## When to reach for it

- the input is sorted, or the answer space is monotonic (a predicate flips from
  false to true exactly once)
- "minimum / maximum value such that some condition holds"

## Template

```python
def lower_bound(lo, hi, ok):
    # smallest x in [lo, hi] with ok(x) True; assumes monotonic ok
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

## Complexity

- Time: O(log n) comparisons (times the cost of `ok`).
- Space: O(1).

## Common pitfalls

- Infinite loops from the wrong `mid` rounding with `lo = mid`.
- Searching an answer space that isn't actually monotonic.

> Sample content — replace with your own deep notes over time.
```

`content/patterns/graphs-bfs-dfs.md`:
```markdown
## Intuition

Explore a graph by following edges. BFS expands in layers (shortest path in
unweighted graphs); DFS dives deep first (connectivity, cycles, topological
order).

## When to reach for it

- grids or adjacency lists, "number of islands / regions / components"
- shortest path in an **unweighted** graph → BFS
- reachability, cycle detection, ordering → DFS

## Template

```python
from collections import deque

def bfs(start, neighbors):
    seen = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        for nxt in neighbors(node):
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return seen
```

## Complexity

- Time: O(V + E).
- Space: O(V) for the visited set and frontier.

## Common pitfalls

- Marking visited when dequeuing instead of when enqueuing (BFS) — can revisit.
- Forgetting bounds/visited checks on grid neighbors.

> Sample content — replace with your own deep notes over time.
```

- [ ] **Step 6: Commit**

```bash
git add lib/content/loadPattern.ts lib/content/loadPattern.test.ts content/patterns
git commit -m "feat: add pattern content loader and sample content"
```

---

## Task 4: Patterns data helpers (TDD)

**Files:**
- Create: `lib/db/patterns.ts`, `lib/db/patterns.test.ts`

**Interfaces:**
- Consumes: a `Database.Database` (tests pass in-memory; app passes `getDb()`). Tests create the `patterns` table inline.
- Produces:
  - `interface PatternRow { id: number; name: string; slug: string; status: string; ordering: number }`
  - `listPatterns(db): PatternRow[]` — ordered by `ordering`, then `name`.
  - `getPatternBySlug(db, slug: string): PatternRow | null`.

- [ ] **Step 1: Write the failing tests**

`lib/db/patterns.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listPatterns, getPatternBySlug } from "./patterns";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE patterns (
       id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
       content_path TEXT, status TEXT NOT NULL DEFAULT 'not_started',
       ordering INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now')));`
  );
  db.prepare(
    "INSERT INTO patterns (name, slug, status, ordering) VALUES (?,?,?,?)"
  ).run("Binary Search", "binary-search", "not_started", 2);
  db.prepare(
    "INSERT INTO patterns (name, slug, status, ordering) VALUES (?,?,?,?)"
  ).run("Sliding Window", "sliding-window", "learning", 1);
});

describe("listPatterns", () => {
  it("returns patterns ordered by ordering then name", () => {
    const rows = listPatterns(db);
    expect(rows.map((r) => r.slug)).toEqual(["sliding-window", "binary-search"]);
    expect(rows[0].status).toBe("learning");
  });
});

describe("getPatternBySlug", () => {
  it("returns the matching pattern", () => {
    expect(getPatternBySlug(db, "binary-search")?.name).toBe("Binary Search");
  });
  it("returns null when not found", () => {
    expect(getPatternBySlug(db, "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/patterns.test.ts`
Expected: FAIL — cannot find `./patterns`.

- [ ] **Step 3: Implement the helpers**

`lib/db/patterns.ts`:
```ts
import type Database from "better-sqlite3";

export interface PatternRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  ordering: number;
}

export function listPatterns(db: Database.Database): PatternRow[] {
  return db
    .prepare(
      "SELECT id, name, slug, status, ordering FROM patterns ORDER BY ordering, name"
    )
    .all() as PatternRow[];
}

export function getPatternBySlug(
  db: Database.Database,
  slug: string
): PatternRow | null {
  const row = db
    .prepare(
      "SELECT id, name, slug, status, ordering FROM patterns WHERE slug = ?"
    )
    .get(slug) as PatternRow | undefined;
  return row ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/patterns.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/patterns.ts lib/db/patterns.test.ts
git commit -m "feat: add patterns data helpers"
```

---

## Task 5: Patterns list page

**Files:**
- Modify: `app/(shell)/patterns/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getDb()`, `listPatterns(db)` → `PatternRow[]`.
- Produces: a server-rendered list at `/patterns`; each row links to `/patterns/<slug>` and shows the name + status.

- [ ] **Step 1: Implement the list page**

`app/(shell)/patterns/page.tsx`:
```tsx
import Link from "next/link";
import { getDb } from "@/lib/db/connection";
import { listPatterns } from "@/lib/db/patterns";

export const dynamic = "force-dynamic";

export default function PatternsPage() {
  const patterns = listPatterns(getDb());
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Patterns</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {patterns.map((p) => (
          <Link
            key={p.slug}
            href={`/patterns/${p.slug}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.status.replace("_", " ")}</span>
          </Link>
        ))}
        {patterns.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No patterns yet. Run `npm run seed`.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1; npm run dev`
Then load `http://localhost:3000/patterns`.
Expected: three rows — Sliding Window, Binary Search, Graphs · BFS/DFS — each a link to `/patterns/<slug>`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add "app/(shell)/patterns/page.tsx"
git commit -m "feat: add patterns list page"
```

---

## Task 6: Notes data helpers (TDD)

**Files:**
- Create: `lib/db/notes.ts`, `lib/db/notes.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create the `notes` table inline.
- Produces:
  - `interface NoteRow { id: number; pattern_id: number; section_key: string; body: string }`
  - `listNotesForPattern(db, patternId: number): NoteRow[]` — ordered by `id`.
  - `addNote(db, patternId: number, sectionKey: string, body: string): NoteRow` — inserts and returns the created row.
  - `deleteNote(db, noteId: number): void`.

- [ ] **Step 1: Write the failing tests**

`lib/db/notes.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listNotesForPattern, addNote, deleteNote } from "./notes";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(
    `CREATE TABLE notes (
       id INTEGER PRIMARY KEY, pattern_id INTEGER NOT NULL, section_key TEXT NOT NULL,
       body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now')));`
  );
});

describe("notes helpers", () => {
  it("adds a note and returns the created row", () => {
    const note = addNote(db, 1, "intuition", "lead with amortized O(n)");
    expect(note.id).toBeGreaterThan(0);
    expect(note).toMatchObject({
      pattern_id: 1,
      section_key: "intuition",
      body: "lead with amortized O(n)",
    });
  });

  it("lists notes for a pattern in insertion order", () => {
    addNote(db, 1, "intuition", "first");
    addNote(db, 1, "template", "second");
    addNote(db, 2, "intuition", "other pattern");
    const rows = listNotesForPattern(db, 1);
    expect(rows.map((r) => r.body)).toEqual(["first", "second"]);
  });

  it("deletes a note by id", () => {
    const note = addNote(db, 1, "intuition", "temp");
    deleteNote(db, note.id);
    expect(listNotesForPattern(db, 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/notes.test.ts`
Expected: FAIL — cannot find `./notes`.

- [ ] **Step 3: Implement the helpers**

`lib/db/notes.ts`:
```ts
import type Database from "better-sqlite3";

export interface NoteRow {
  id: number;
  pattern_id: number;
  section_key: string;
  body: string;
}

export function listNotesForPattern(
  db: Database.Database,
  patternId: number
): NoteRow[] {
  return db
    .prepare(
      "SELECT id, pattern_id, section_key, body FROM notes WHERE pattern_id = ? ORDER BY id"
    )
    .all(patternId) as NoteRow[];
}

export function addNote(
  db: Database.Database,
  patternId: number,
  sectionKey: string,
  body: string
): NoteRow {
  const info = db
    .prepare(
      "INSERT INTO notes (pattern_id, section_key, body) VALUES (?, ?, ?)"
    )
    .run(patternId, sectionKey, body);
  return db
    .prepare("SELECT id, pattern_id, section_key, body FROM notes WHERE id = ?")
    .get(info.lastInsertRowid) as NoteRow;
}

export function deleteNote(db: Database.Database, noteId: number): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/notes.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/notes.ts lib/db/notes.test.ts
git commit -m "feat: add notes data helpers"
```

---

## Task 7: Note server actions + pattern detail page

**Files:**
- Create: `lib/notes/actions.ts`, `app/(shell)/patterns/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getDb()`, `getPatternBySlug` (Task 4), `loadPatternContent` (Task 3), `splitSections` (Task 2), `listNotesForPattern`/`addNote`/`deleteNote` (Task 6), `MarkdownView` (Task 1).
- Produces: server actions `addNoteAction(formData: FormData): Promise<void>` and `deleteNoteAction(formData: FormData): Promise<void>`; the reading page at `/patterns/<slug>`.

- [ ] **Step 1: Implement the server actions**

`lib/notes/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { addNote, deleteNote } from "@/lib/db/notes";

export async function addNoteAction(formData: FormData): Promise<void> {
  const patternId = Number(formData.get("patternId"));
  const sectionKey = String(formData.get("sectionKey") ?? "").trim();
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!patternId || !sectionKey || body === "") return;
  addNote(getDb(), patternId, sectionKey, body);
  revalidatePath(`/patterns/${slug}`);
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const noteId = Number(formData.get("noteId"));
  const slug = String(formData.get("slug") ?? "");
  if (!noteId) return;
  deleteNote(getDb(), noteId);
  revalidatePath(`/patterns/${slug}`);
}
```

- [ ] **Step 2: Implement the detail page**

`app/(shell)/patterns/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/connection";
import { getPatternBySlug } from "@/lib/db/patterns";
import { listNotesForPattern, type NoteRow } from "@/lib/db/notes";
import { loadPatternContent } from "@/lib/content/loadPattern";
import { splitSections } from "@/lib/content/sections";
import { MarkdownView } from "@/components/MarkdownView";
import { addNoteAction, deleteNoteAction } from "@/lib/notes/actions";

export const dynamic = "force-dynamic";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const pattern = getPatternBySlug(db, slug);
  if (!pattern) notFound();

  const content = loadPatternContent(slug);
  const sections = content ? splitSections(content) : [];
  const notes = listNotesForPattern(db, pattern.id);
  const notesBySection = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const list = notesBySection.get(n.section_key) ?? [];
    list.push(n);
    notesBySection.set(n.section_key, list);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>{pattern.name}</h1>
      {!content && (
        <p style={{ color: "var(--muted)" }}>
          No study content yet for this pattern.
        </p>
      )}

      {sections.map((section) => (
        <section key={section.key} style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18 }}>{section.title}</h2>
          <MarkdownView markdown={section.body} />

          {(notesBySection.get(section.key) ?? []).map((note) => (
            <div
              key={note.id}
              style={{
                borderLeft: "3px solid var(--accent)",
                background: "var(--panel)",
                borderRadius: "0 6px 6px 0",
                padding: "8px 12px",
                margin: "8px 0",
              }}
            >
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)" }}>
                my note
              </div>
              <div>{note.body}</div>
              <form action={deleteNoteAction} style={{ marginTop: 6 }}>
                <input type="hidden" name="noteId" value={note.id} />
                <input type="hidden" name="slug" value={slug} />
                <button
                  type="submit"
                  style={{ fontSize: 11, background: "transparent", color: "var(--muted)", border: "none", cursor: "pointer", padding: 0 }}
                >
                  delete
                </button>
              </form>
            </div>
          ))}

          <form action={addNoteAction} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="hidden" name="patternId" value={pattern.id} />
            <input type="hidden" name="sectionKey" value={section.key} />
            <input type="hidden" name="slug" value={slug} />
            <input
              type="text"
              name="body"
              placeholder={`Add a note to "${section.title}"`}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--fg)",
              }}
            />
            <button
              type="submit"
              style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "white" }}
            >
              Add
            </button>
          </form>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Verify rendering + note add/delete in the browser**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1; npm run dev`
Then load `http://localhost:3000/patterns/sliding-window`.
Expected: the pattern name as the title, the sections (Intuition, When to reach for it, Template with a highlighted code block, Complexity, Common pitfalls), each with an "Add a note…" field. Add a note under Intuition → it appears as a highlighted block with a "delete" control. Click delete → it disappears. Visit `/patterns/does-not-exist` → a 404. Stop the dev server.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add lib/notes/actions.ts "app/(shell)/patterns/[slug]"
git commit -m "feat: add pattern detail reading page with inline notes"
```

---

## Task 8: Read-only "Problems in this pattern" list

**Files:**
- Create: `lib/db/problemsForPattern.ts`, `lib/db/problemsForPattern.test.ts`
- Modify: `app/(shell)/patterns/[slug]/page.tsx` (append the list)

**Interfaces:**
- Consumes: `Database.Database`; the page also uses `pattern.id` and the helper.
- Produces:
  - `interface ProblemRow { id: number; title: string; lc_url: string | null; difficulty: string; status: string }`
  - `listProblemsForPattern(db, patternId: number): ProblemRow[]` — joins `problem_patterns`, ordered by `title`.

- [ ] **Step 1: Write the failing test**

`lib/db/problemsForPattern.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listProblemsForPattern } from "./problemsForPattern";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      lc_slug TEXT, lc_url TEXT, difficulty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE problem_patterns (problem_id INTEGER NOT NULL, pattern_id INTEGER NOT NULL,
      PRIMARY KEY (problem_id, pattern_id));
  `);
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (?,?,?,?)").run(
    1, "Longest Substring", "https://lc/1", "Medium");
  db.prepare("INSERT INTO problems (id,title,lc_url,difficulty) VALUES (?,?,?,?)").run(
    2, "Two Sum", "https://lc/2", "Easy");
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (?,?)").run(1, 10);
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (?,?)").run(2, 99);
});

describe("listProblemsForPattern", () => {
  it("returns only problems mapped to the pattern, ordered by title", () => {
    const rows = listProblemsForPattern(db, 10);
    expect(rows.map((r) => r.title)).toEqual(["Longest Substring"]);
    expect(rows[0].difficulty).toBe("Medium");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/problemsForPattern.test.ts`
Expected: FAIL — cannot find `./problemsForPattern`.

- [ ] **Step 3: Implement the helper**

`lib/db/problemsForPattern.ts`:
```ts
import type Database from "better-sqlite3";

export interface ProblemRow {
  id: number;
  title: string;
  lc_url: string | null;
  difficulty: string;
  status: string;
}

export function listProblemsForPattern(
  db: Database.Database,
  patternId: number
): ProblemRow[] {
  return db
    .prepare(
      `SELECT p.id, p.title, p.lc_url, p.difficulty, p.status
       FROM problems p
       JOIN problem_patterns pp ON pp.problem_id = p.id
       WHERE pp.pattern_id = ?
       ORDER BY p.title`
    )
    .all(patternId) as ProblemRow[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/problemsForPattern.test.ts`
Expected: PASS.

- [ ] **Step 5: Append the list to the detail page**

In `app/(shell)/patterns/[slug]/page.tsx`, add this import with the others:
```tsx
import { listProblemsForPattern } from "@/lib/db/problemsForPattern";
```

After the line `const notes = listNotesForPattern(db, pattern.id);`, add:
```tsx
  const problems = listProblemsForPattern(db, pattern.id);
```

Immediately before the closing `</main>` tag, add:
```tsx
      <section style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Problems in this pattern</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {problems.map((p) => (
            <a
              key={p.id}
              href={p.lc_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
            >
              <span>{p.title}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.difficulty} ↗</span>
            </a>
          ))}
          {problems.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No problems mapped yet.</p>
          )}
        </div>
      </section>
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`, load `http://localhost:3000/patterns/sliding-window`.
Expected: below the content, a "Problems in this pattern" list showing "Longest Substring Without Repeating Characters" (Medium) linking out to leetcode.com in a new tab. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add lib/db/problemsForPattern.ts lib/db/problemsForPattern.test.ts "app/(shell)/patterns/[slug]/page.tsx"
git commit -m "feat: list mapped problems on the pattern page (read-only)"
```

---

## Definition of Done (Phase 1)

- `/patterns` lists the seeded patterns, each linking to its detail page.
- `/patterns/<slug>` renders the Markdown study content as sections with syntax-highlighted code.
- Each section has an inline add-note field; notes render as highlighted blocks tied to that section and can be deleted. Notes persist in SQLite keyed by `(pattern_id, section_key)`.
- A missing content file degrades gracefully; an unknown slug 404s.
- The pattern page shows a read-only list of mapped problems linking out to LeetCode.
- `npm test` passes (Phase 0 tests + all new unit/component tests).

## Self-Review Notes

- **Spec coverage:** §8.2 pattern list + detail ✓ (Tasks 5, 7); Markdown rendering with highlighting ✓ (Task 1); section-level inline notes with stable `section_key` anchoring ✓ (Tasks 2, 6, 7); sample/placeholder content only, real authoring deferred ✓ (Task 3). Mapped-problems strip is included read-only (Task 8); interactive logging via the log popover remains Phase 2.
- **Placeholder scan:** none — every step has runnable code/commands. Sample content is intentionally marked as sample, not a plan placeholder.
- **Type consistency:** `PatternRow`, `NoteRow`, `ProblemRow`, `Section`, `slugify`, `splitSections`, `loadPatternContent`, `listPatterns`, `getPatternBySlug`, `listNotesForPattern`, `addNote`, `deleteNote`, `addNoteAction`, `deleteNoteAction`, `listProblemsForPattern`, `MarkdownView` are used consistently across tasks.
- **Note on Next 15 params:** the detail page awaits `params` (Promise) per Next 15 App Router; matches the installed version.
