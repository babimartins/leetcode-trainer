# DSA Trainer — Agent Guidance

## Development Model: Superpowers-Guided Phase Execution

This project uses **agentic task-driven development**. Work is structured as sequential phases, each decomposed into discrete tasks with exact requirements.

### Directory Structure

- **`docs/superpowers/specs/`** — Full design documents (architecture, data model, constraints). Read once before implementation.
- **`docs/superpowers/plans/`** — Detailed phase plans breaking work into numbered tasks with step-by-step instructions, file-by-file contracts, and verification commands.
- **`.superpowers/sdd/`** (git-ignored) — Task briefs and progress tracking for agentic workers.
  - `task-N-brief.md` — Exact file contents and steps for task N (use verbatim).
  - `progress.md` — Checkbox tracking during execution.
  - `task-N-report.md` — Results and blockers after task completion.

### Implementing a Task

1. Read the phase plan (`docs/superpowers/plans/YYYYMMDD-phase-name.md`) for context and full task descriptions.
2. Follow the task brief (`.superpowers/sdd/task-N-brief.md`) step by step — it contains all file contents and commands.
3. Run verification commands at each step (npm install, npm test, npm run dev, etc.).
4. Commit only files listed in the brief; follow the exact commit message format.
5. Write a report to `.superpowers/sdd/task-N-report.md` with status, commits, test results, and any concerns.

### Global Constraints (All Phases)

- Runs locally via `npm run dev` on `localhost:3000`. Single user, no auth.
- TypeScript everywhere. App Router (`app/` directory), not Pages Router.
- Database access is **server-side only** (`better-sqlite3` must never import into client components).
- SQLite database at `data/dsa.sqlite` (gitignored). Content Markdown under `content/`.
- No face emojis in UI. Plain text labels.
- Secrets (Anthropic API key) never committed; stored in local SQLite `app_state` table.

### Data Helper Functions (`lib/db/`)

- Each table gets a dedicated helper module (e.g., `lib/db/patterns.ts`, `lib/db/appState.ts`): export a `*Row` interface and query functions.
- Query functions take `db: Database.Database` as the first parameter (enables passing in-memory test databases). Cast results to the row interface using `as RowType` — never `any`.
- Tests create an in-memory SQLite db (`new Database(":memory:")`), create tables inline via `db.exec()`, and exercise the helpers. Use `beforeEach` to reset state.
- **Traversing relationships via JOIN**: To query across a junction table (e.g., `listProblemsForPattern` joins `problem_patterns` to `problems`), alias the tables in the SQL, select columns with table prefix, and return a `Row` interface matching all fetched columns. See `lib/db/problemsForPattern.ts` for an example.

### Markdown & Code Highlighting

- Components rendering markdown use react-markdown with `rehypeHighlight` plugin (syntax highlighting). CSS for `.markdown` is added to `globals.css`, not imported into the component.
- Highlight.js theme (e.g., `github-dark.css`) is imported once in `app/layout.tsx` only, directly after `globals.css`.
- When testing markdown code blocks: `rehypeHighlight` tokenizes code into `<span>` elements, splitting text nodes. Use `container.querySelector("pre code")?.textContent` assertions instead of `getByText()`.
- **XSS safety**: Never add `rehypeRaw`, `skipHtml`, or `allowDangerousHtml` options — `react-markdown` escapes HTML by default. User-generated content (notes, authored markdown) renders safely as escaped text.

### Markdown Section Keys

- When parsing Markdown headers to extract sections, derive `section_key` via `slugify()` — lowercase, collapse non-alphanumeric runs to single hyphens, trim leading/trailing hyphens.
- Content before the first `##` heading is always a leading overview section with hardcoded `key: "overview"` (omitted if empty/whitespace). See `lib/content/sections.ts` for reference.

### Content Loader Functions

- Content loaders (e.g., `loadPatternContent()`) should accept `slug` and optional `baseDir` parameters, defaulting `baseDir` to `path.join(process.cwd(), "content", "<type>")`.
- Return `string | null` (null if the markdown file is missing). Use `node:fs` and `node:path` only (server-side, no client imports).
- Test loaders with temporary directories via `fs.mkdtempSync()` and `fs.rmSync()` in beforeEach/afterEach blocks, not committed fixtures.

### List Pages (e.g., `/patterns`, `/problems`)

- Server components marked `export const dynamic = "force-dynamic"` that fetch records from the database.
- Call a query function (e.g., `listPatterns(getDb())`) and render as styled `<Link>` wrappers with `href={"/resource/<slug>"}`.
- Each link displays bold name + muted metadata (status, count, etc.) side-by-side using flexbox.
- Use inline styles with CSS variables (`var(--border)`, `var(--muted)`, `var(--fg)`) for theming consistency.

### Server Actions (Mutations)

- Place mutation actions in `lib/<domain>/actions.ts` with `"use server"` directive. Accept `formData: FormData` parameter.
- Validate inputs early: trim string fields, coerce numeric fields via `Number()`, check for empty/falsy values, and early-return on guard failure (no-op).
- Call DB helpers via `getDb()` and always call `revalidatePath(\`/patterns/${slug}\`)` (or equivalent) after a successful mutation for ISR refresh.
