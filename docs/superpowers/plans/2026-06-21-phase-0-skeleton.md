# DSA Trainer — Phase 0 (Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable Next.js + SQLite skeleton — app shell with navigation, a working schema + migration runner, seed data, and a Settings screen that persists the Anthropic API key — so later phases have a foundation to build on.

**Architecture:** Single Next.js (App Router, TypeScript) app. `better-sqlite3` provides synchronous SQLite access from server code, with a tiny hand-written migration runner that applies ordered `.sql` files and records them in a `_migrations` table. The app shell is a persistent left-nav layout wrapping per-route pages; Settings persists values to an `app_state` key/value table via a server action.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `better-sqlite3`, Vitest + `@testing-library/react` (jsdom), `tsx` for scripts.

## Global Constraints

- Runs locally via `npm run dev` on `localhost:3000`. Single user, no auth.
- TypeScript everywhere. App Router (`app/` directory), not Pages Router.
- All database access is **server-side only** (`better-sqlite3` is a native module and must never be imported into client components).
- SQLite database file lives at `data/dsa.sqlite` (gitignored). Content Markdown (future) lives under `content/`.
- No face emojis in UI. Plain text labels on controls.
- Secrets (Anthropic API key) are never committed; stored in the local SQLite `app_state` table.

---

## File Structure

- `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` — project config.
- `app/layout.tsx` — root layout, imports global styles.
- `app/globals.css` — minimal global styles + CSS variables.
- `app/(shell)/layout.tsx` — the persistent left-nav app shell.
- `app/(shell)/page.tsx` — Today (placeholder).
- `app/(shell)/patterns/page.tsx`, `problems/page.tsx`, `review/page.tsx`, `stats/page.tsx` — placeholders.
- `app/(shell)/settings/page.tsx` — Settings screen.
- `components/NavRail.tsx` — left navigation component.
- `lib/db/connection.ts` — SQLite connection singleton.
- `lib/db/migrate.ts` — migration runner.
- `lib/db/appState.ts` — get/set helpers for the `app_state` table.
- `lib/db/migrations/0001_init.sql` — initial schema.
- `lib/db/migrations/0002_app_state.sql` — app_state table (kept separate to show the runner applies multiple files).
- `scripts/migrate.ts` — CLI entry to run migrations.
- `scripts/seed.ts` — inserts sample patterns + problems.
- `lib/settings/actions.ts` — server action to save settings.
- Tests: `lib/db/migrate.test.ts`, `lib/db/appState.test.ts`, `components/NavRail.test.tsx`.

---

## Task 1: Scaffold the Next.js app + test tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `app/layout.tsx`, `app/globals.css`, `app/(shell)/page.tsx`, `app/sanity.test.ts`

**Interfaces:**
- Produces: a runnable Next.js app and a working `npm test` (Vitest) command.

- [ ] **Step 1: Create the project config files**

`package.json`:
```json
{
  "name": "dsa-trainer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate": "tsx scripts/migrate.ts",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Create the root layout, global styles, and a placeholder home**

`app/globals.css`:
```css
:root {
  --bg: #0f1115;
  --fg: #e7e9ee;
  --muted: #9aa0ab;
  --border: rgba(255, 255, 255, 0.12);
  --accent: #6366f1;
  --panel: rgba(255, 255, 255, 0.04);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
a { color: inherit; text-decoration: none; }
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "DSA Trainer" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/(shell)/page.tsx` (temporary — replaced in Task 5's shell, but lets the app boot now):
```tsx
export default function TodayPage() {
  return <main style={{ padding: 24 }}>Today</main>;
}
```

- [ ] **Step 3: Write a sanity test**

`app/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("tooling", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Install dependencies and run the test**

Run: `npm install && npm test`
Expected: Vitest runs, `tooling > runs vitest` PASSES.

- [ ] **Step 5: Verify the app boots**

Run: `npm run dev` then open `http://localhost:3000`
Expected: page shows "Today". Stop the dev server (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Vitest tooling"
```

---

## Task 2: SQLite connection + migration runner (TDD)

**Files:**
- Create: `lib/db/connection.ts`, `lib/db/migrate.ts`, `lib/db/migrate.test.ts`

**Interfaces:**
- Produces:
  - `getDb(): Database.Database` — returns a singleton connection to `data/dsa.sqlite`, creating the `data/` dir if missing.
  - `runMigrations(db: Database.Database, migrationsDir: string): string[]` — applies any `.sql` files in `migrationsDir` (sorted by filename) not yet recorded in `_migrations`, each in a transaction; returns the list of filenames applied this run.

- [ ] **Step 1: Write the failing test**

`lib/db/migrate.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "./migrate";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeMigration(name: string, sql: string) {
  fs.writeFileSync(path.join(dir, name), sql);
}

describe("runMigrations", () => {
  it("applies pending migrations in filename order and records them", () => {
    writeMigration("0001_a.sql", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    writeMigration("0002_b.sql", "CREATE TABLE b (id INTEGER PRIMARY KEY);");
    const db = new Database(":memory:");

    const applied = runMigrations(db, dir);

    expect(applied).toEqual(["0001_a.sql", "0002_b.sql"]);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("a");
    expect(tables).toContain("b");
    expect(tables).toContain("_migrations");
  });

  it("is idempotent — a second run applies nothing", () => {
    writeMigration("0001_a.sql", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    const db = new Database(":memory:");
    runMigrations(db, dir);

    const secondRun = runMigrations(db, dir);

    expect(secondRun).toEqual([]);
  });

  it("rolls back a failing migration atomically", () => {
    writeMigration("0001_ok.sql", "CREATE TABLE ok (id INTEGER PRIMARY KEY);");
    writeMigration("0002_bad.sql", "CREATE TABLE ok (id INTEGER);"); // duplicate table -> error
    const db = new Database(":memory:");

    expect(() => runMigrations(db, dir)).toThrow();
    const recorded = db
      .prepare("SELECT name FROM _migrations ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(recorded).toEqual(["0001_ok.sql"]); // 0002 not recorded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/migrate.test.ts`
Expected: FAIL — `runMigrations` is not defined / module not found.

- [ ] **Step 3: Write the migration runner**

`lib/db/migrate.ts`:
```ts
import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function runMigrations(
  db: Database.Database,
  migrationsDir: string
): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`
  );

  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const justApplied: string[] = [];
  const record = db.prepare("INSERT INTO _migrations (name) VALUES (?)");

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      record.run(file);
    });
    tx();
    justApplied.push(file);
  }

  return justApplied;
}
```

- [ ] **Step 4: Write the connection singleton**

`lib/db/connection.ts`:
```ts
import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "dsa.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  instance = db;
  return instance;
}
```

(Note: `connection.ts` imports `server-only`, so it is not imported by the test; tests construct their own in-memory `Database`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db/migrate.test.ts`
Expected: all three tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/connection.ts lib/db/migrate.ts lib/db/migrate.test.ts
git commit -m "feat: add sqlite connection and migration runner"
```

---

## Task 3: Initial schema migrations + migrate script

**Files:**
- Create: `lib/db/migrations/0001_init.sql`, `lib/db/migrations/0002_app_state.sql`, `scripts/migrate.ts`

**Interfaces:**
- Consumes: `getDb()` from Task 2, `runMigrations(db, dir)` from Task 2.
- Produces: a populated schema and `npm run migrate` that applies it. Tables: `patterns`, `problems`, `sources`, `problem_sources`, `problem_patterns`, `attempts`, `notes`, `reviews`, `tutor_sessions`, `tutor_messages`, `app_state`.

- [ ] **Step 1: Write the initial schema migration**

`lib/db/migrations/0001_init.sql`:
```sql
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_path TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  ordering INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE problems (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  lc_slug TEXT,
  lc_url TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE problem_sources (
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, source_id)
);

CREATE TABLE problem_patterns (
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, pattern_id)
);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  outcome TEXT NOT NULL CHECK (outcome IN ('solved','partial','failed')),
  rating TEXT CHECK (rating IN ('hard','ok','easy')),
  minutes INTEGER,
  used_hint INTEGER NOT NULL DEFAULT 0,
  reflection TEXT
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('problem','pattern')),
  item_id INTEGER NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  last_reviewed TEXT,
  UNIQUE (item_type, item_id)
);

CREATE TABLE tutor_sessions (
  id INTEGER PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('pattern','problem')),
  scope_id INTEGER NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tutor_messages (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attempts_problem ON attempts(problem_id);
CREATE INDEX idx_reviews_due ON reviews(due_date);
CREATE INDEX idx_notes_pattern ON notes(pattern_id);
```

- [ ] **Step 2: Write the app_state migration**

`lib/db/migrations/0002_app_state.sql`:
```sql
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

- [ ] **Step 3: Write the migrate script**

`scripts/migrate.ts`:
```ts
import path from "node:path";
import { getDb } from "@/lib/db/connection";
import { runMigrations } from "@/lib/db/migrate";

const dir = path.join(process.cwd(), "lib", "db", "migrations");
const applied = runMigrations(getDb(), dir);
if (applied.length === 0) {
  console.log("No pending migrations.");
} else {
  console.log("Applied:", applied.join(", "));
}
```

- [ ] **Step 4: Run the migration and verify the schema**

Run: `npm run migrate`
Expected: prints `Applied: 0001_init.sql, 0002_app_state.sql`.

Run: `npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all().map(r=>r.name).join(','))})"`
Expected: comma list including `app_state,attempts,notes,patterns,problem_patterns,problem_sources,problems,reviews,sources,tutor_messages,tutor_sessions` (and `_migrations`).

- [ ] **Step 5: Run migrate again to confirm idempotency**

Run: `npm run migrate`
Expected: prints `No pending migrations.`

- [ ] **Step 6: Commit**

```bash
git add lib/db/migrations scripts/migrate.ts
git commit -m "feat: add initial schema and migrate script"
```

---

## Task 4: app_state helpers (TDD) + seed script

**Files:**
- Create: `lib/db/appState.ts`, `lib/db/appState.test.ts`, `scripts/seed.ts`

**Interfaces:**
- Consumes: a `Database.Database` (tests pass in-memory; app passes `getDb()`).
- Produces:
  - `getAppState(db, key: string): string | null`
  - `setAppState(db, key: string, value: string): void`
  - `npm run seed` — inserts sample patterns + problems + a source list (idempotent via `INSERT OR IGNORE` on unique slugs/names).

- [ ] **Step 1: Write the failing test**

`lib/db/appState.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getAppState, setAppState } from "./appState";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);");
});

describe("app_state helpers", () => {
  it("returns null for a missing key", () => {
    expect(getAppState(db, "nope")).toBeNull();
  });

  it("sets then gets a value", () => {
    setAppState(db, "anthropic_api_key", "sk-test-123");
    expect(getAppState(db, "anthropic_api_key")).toBe("sk-test-123");
  });

  it("upserts — setting an existing key overwrites it", () => {
    setAppState(db, "k", "v1");
    setAppState(db, "k", "v2");
    expect(getAppState(db, "k")).toBe("v2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/appState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

`lib/db/appState.ts`:
```ts
import type Database from "better-sqlite3";

export function getAppState(
  db: Database.Database,
  key: string
): string | null {
  const row = db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setAppState(
  db: Database.Database,
  key: string,
  value: string
): void {
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/appState.test.ts`
Expected: all three PASS.

- [ ] **Step 5: Write the seed script**

`scripts/seed.ts`:
```ts
import { getDb } from "@/lib/db/connection";

const db = getDb();

const insertPattern = db.prepare(
  `INSERT OR IGNORE INTO patterns (name, slug, status, ordering)
   VALUES (?, ?, 'not_started', ?)`
);
const patterns: Array<[string, string, number]> = [
  ["Sliding Window", "sliding-window", 1],
  ["Binary Search", "binary-search", 2],
  ["Graphs · BFS/DFS", "graphs-bfs-dfs", 3],
];
patterns.forEach((p) => insertPattern.run(...p));

const insertSource = db.prepare(
  "INSERT OR IGNORE INTO sources (name) VALUES (?)"
);
insertSource.run("Blind 75");

const insertProblem = db.prepare(
  `INSERT OR IGNORE INTO problems (title, lc_slug, lc_url, difficulty)
   VALUES (?, ?, ?, ?)`
);
const problems: Array<[string, string, string, string]> = [
  [
    "Longest Substring Without Repeating Characters",
    "longest-substring-without-repeating-characters",
    "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    "Medium",
  ],
  [
    "Koko Eating Bananas",
    "koko-eating-bananas",
    "https://leetcode.com/problems/koko-eating-bananas/",
    "Medium",
  ],
  [
    "Number of Islands",
    "number-of-islands",
    "https://leetcode.com/problems/number-of-islands/",
    "Medium",
  ],
];
problems.forEach((p) => insertProblem.run(...p));

console.log(
  `Seeded: ${patterns.length} patterns, ${problems.length} problems, 1 source.`
);
```

- [ ] **Step 6: Run the seed and verify**

Run: `npm run seed`
Expected: prints `Seeded: 3 patterns, 3 problems, 1 source.`

Run: `npm run seed` again
Expected: same message, and no duplicate rows (verify: `npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log('patterns',db.prepare('SELECT COUNT(*) c FROM patterns').get().c)})"` prints `patterns 3`).

- [ ] **Step 7: Commit**

```bash
git add lib/db/appState.ts lib/db/appState.test.ts scripts/seed.ts
git commit -m "feat: add app_state helpers and seed script"
```

---

## Task 5: App shell with navigation + placeholder pages

**Files:**
- Create: `components/NavRail.tsx`, `components/NavRail.test.tsx`, `app/(shell)/layout.tsx`, `app/(shell)/patterns/page.tsx`, `app/(shell)/problems/page.tsx`, `app/(shell)/review/page.tsx`, `app/(shell)/stats/page.tsx`
- Modify: `app/(shell)/page.tsx` (replace temporary content with a titled placeholder)

**Interfaces:**
- Consumes: nothing from prior tasks (pure UI).
- Produces: `NavRail` component rendering links to Today (`/`), Patterns (`/patterns`), Problems (`/problems`), Review queue (`/review`), Stats (`/stats`), Settings (`/settings`); a `(shell)` layout wrapping all pages with the rail.

- [ ] **Step 1: Write the failing component test**

`components/NavRail.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavRail } from "./NavRail";

describe("NavRail", () => {
  it("renders all primary destinations with correct hrefs", () => {
    render(<NavRail />);
    const expected: Array<[string, string]> = [
      ["Today", "/"],
      ["Patterns", "/patterns"],
      ["Problems", "/problems"],
      ["Review queue", "/review"],
      ["Stats", "/stats"],
      ["Settings", "/settings"],
    ];
    for (const [label, href] of expected) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/NavRail.test.tsx`
Expected: FAIL — cannot find `./NavRail`.

- [ ] **Step 3: Implement NavRail**

`components/NavRail.tsx`:
```tsx
import Link from "next/link";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Today", href: "/" },
  { label: "Patterns", href: "/patterns" },
  { label: "Problems", href: "/problems" },
  { label: "Review queue", href: "/review" },
  { label: "Stats", href: "/stats" },
  { label: "Settings", href: "/settings" },
];

export function NavRail() {
  return (
    <nav
      style={{
        width: 180,
        borderRight: "1px solid var(--border)",
        background: "var(--panel)",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: "100vh",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 14 }}>DSA Trainer</div>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ padding: "8px 10px", borderRadius: 6, color: "var(--fg)" }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/NavRail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the shell layout and placeholder pages**

`app/(shell)/layout.tsx`:
```tsx
import type { ReactNode } from "react";
import { NavRail } from "@/components/NavRail";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavRail />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
```

`app/(shell)/page.tsx` (replace temporary content):
```tsx
export default function TodayPage() {
  return <main style={{ padding: 24 }}><h1>Today</h1></main>;
}
```

`app/(shell)/patterns/page.tsx`:
```tsx
export default function PatternsPage() {
  return <main style={{ padding: 24 }}><h1>Patterns</h1></main>;
}
```

`app/(shell)/problems/page.tsx`:
```tsx
export default function ProblemsPage() {
  return <main style={{ padding: 24 }}><h1>Problems</h1></main>;
}
```

`app/(shell)/review/page.tsx`:
```tsx
export default function ReviewPage() {
  return <main style={{ padding: 24 }}><h1>Review queue</h1></main>;
}
```

`app/(shell)/stats/page.tsx`:
```tsx
export default function StatsPage() {
  return <main style={{ padding: 24 }}><h1>Stats</h1></main>;
}
```

- [ ] **Step 6: Verify navigation in the browser**

Run: `npm run dev`, open `http://localhost:3000`
Expected: left rail visible; clicking each link navigates to the matching page heading. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add components/NavRail.tsx components/NavRail.test.tsx "app/(shell)"
git commit -m "feat: add app shell navigation and placeholder pages"
```

---

## Task 6: Settings screen — persist the Anthropic API key

**Files:**
- Create: `lib/settings/actions.ts`, `app/(shell)/settings/page.tsx`

**Interfaces:**
- Consumes: `getDb()` (Task 2), `getAppState` / `setAppState` (Task 4).
- Produces: a Settings page (server component) showing whether a key is saved + the DB file location, and a `saveApiKey` server action that persists to `app_state` under key `anthropic_api_key`.

- [ ] **Step 1: Write the server action**

`lib/settings/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { setAppState } from "@/lib/db/appState";

export async function saveApiKey(formData: FormData): Promise<void> {
  const key = String(formData.get("apiKey") ?? "").trim();
  setAppState(getDb(), "anthropic_api_key", key);
  revalidatePath("/settings");
}
```

- [ ] **Step 2: Write the Settings page**

`app/(shell)/settings/page.tsx`:
```tsx
import path from "node:path";
import { getDb } from "@/lib/db/connection";
import { getAppState } from "@/lib/db/appState";
import { saveApiKey } from "@/lib/settings/actions";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const saved = getAppState(getDb(), "anthropic_api_key");
  const hasKey = Boolean(saved && saved.length > 0);
  const dbPath = path.join(process.cwd(), "data", "dsa.sqlite");

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>Settings</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Anthropic API key</h2>
        <p style={{ color: "var(--muted)" }}>
          Status: {hasKey ? "saved" : "not set"}. Used server-side for the AI
          tutor; never sent to the browser.
        </p>
        <form action={saveApiKey} style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            name="apiKey"
            placeholder="sk-ant-..."
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Data</h2>
        <p style={{ color: "var(--muted)" }}>Database file: {dbPath}</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify end to end in the browser**

Run: `npm run dev`, open `http://localhost:3000/settings`
Expected: shows "Status: not set". Type a value, click Save; page reloads showing "Status: saved".

- [ ] **Step 4: Verify persistence in the database**

Run: `npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log(db.prepare(\"SELECT value FROM app_state WHERE key='anthropic_api_key'\").get())})"`
Expected: prints the saved value. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add lib/settings/actions.ts "app/(shell)/settings"
git commit -m "feat: add settings screen with persisted API key"
```

---

## Definition of Done (Phase 0)

- `npm install` → `npm run migrate` → `npm run seed` → `npm run dev` produces a running app at `localhost:3000`.
- Left-nav shell navigates between Today / Patterns / Problems / Review / Stats / Settings.
- Settings persists the Anthropic API key to SQLite and reports saved/not-set.
- `npm test` passes (migration runner, app_state helpers, NavRail).
- Database schema for all core tables exists and is created reproducibly via migrations.

## Self-Review Notes

- **Spec coverage:** Architecture (Next.js + SQLite + server-side access) ✓; data model tables (§4) all present in `0001_init.sql` ✓; Settings/API key (§8.6) ✓; nav shell with all six destinations (§8) ✓; sample/placeholder content decision — seed inserts sample patterns/problems, no deep content ✓. Reading/notes, SRS, tutor, board, Today widgets are **intentionally deferred** to Phases 1–5.
- **Placeholders:** none — every step has runnable code/commands.
- **Type consistency:** `getDb`, `runMigrations`, `getAppState`, `setAppState`, `saveApiKey`, `NavRail` names are consistent across tasks.
