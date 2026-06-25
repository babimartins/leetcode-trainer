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
- **Field naming**: In result interfaces, preserve snake_case from the database column names (e.g., `interval_days`, `item_type`) rather than normalizing to camelCase — this keeps the interface aligned with the actual database schema.
- Tests create an in-memory SQLite db (`new Database(":memory:")`), create tables inline via `db.exec()`, and exercise the helpers. Use `beforeEach` to reset state.
- **Atomic multi-step updates**: Use `db.transaction(...)` to ensure related writes happen atomically (e.g., `logAttempt` inserts an attempt and updates problem status together). Declare the tx function, call it, and return the result.
- **Traversing relationships via JOIN**: To query across a junction table (e.g., `listProblemsForPattern` joins `problem_patterns` to `problems`), alias the tables in the SQL, select columns with table prefix, and return a `Row` interface matching all fetched columns. See `lib/db/problemsForPattern.ts` for an example.
- **Dynamic filter building**: For query functions with optional filters (e.g., `listProblems`), build WHERE conditions conditionally in a `where: string[]` array with a parallel `params: unknown[]` array. Check non-empty values before appending (`if (filters.field) { where.push(...); params.push(...); }`). Join conditions with `AND` and bind all filter values with `?` placeholders — never interpolate strings. Use correlated subqueries (`SELECT ... FROM ... WHERE ... LIMIT 1`) to fetch aggregate/latest related data, and `EXISTS (SELECT 1 FROM ... JOIN ... WHERE ...)` to filter by junction-table relationships with bound parameters. See `lib/db/problemsList.ts` for a complete example.
- **Upsert pattern**: For insert-or-update operations on unique constraints, use `INSERT ... ON CONFLICT(constraint_col) DO UPDATE SET col = excluded.col` to atomically update fields if the unique constraint is violated. See `lib/db/reviews.ts` and `lib/db/appState.ts` for examples.
- **Stateful schedule updates**: For spaced-repetition or other state-advancing updates (e.g., `recordReview`), always read the current state first via a getter (e.g., `getReviewState`), compute the next state from it, then upsert. This ensures subsequent reviews correctly advance the schedule — the upsert does not need manual state re-reading between calls.
- **Idempotent resource-per-scope pattern**: For entities scoped to a composite key (e.g., tutor sessions per `(scope_type, scope_id)`), export a `find*` function returning `T | null` and a `getOrCreate*` function that calls find first and only inserts if not found. This ensures one logical resource per scope, enabling safe reuse. Use a typed scope union for scope values (e.g., `type TutorScope = "pattern" | "problem"`). See `lib/db/tutor.ts` for an example.
- **Resolve-by-identifier-then-name pattern**: When fetching a record by slug OR human-readable name, create a private `resolve*` helper that tries the direct ID lookup first, then falls back to a case-insensitive full-list scan. Return `T | null`. Reuse this resolver across multiple public functions (e.g., `getPattern()`, `listNotes()`) to avoid duplicating the dual-lookup logic. See `mcp/studyData.ts` `resolvePattern()` for an example.

### Pure Algorithm & Utility Modules (`lib/<domain>/`)

- For math, scheduling, or date algorithms without DB or React dependencies, create a domain-specific module (e.g., `lib/srs/sm2.ts`, `lib/srs/dates.ts`).
- Export typed interfaces for state (e.g., `ReviewState`), constrained type unions for inputs (e.g., `Rating = "hard" | "ok" | "easy"`), and pure functions taking these types.
- Define algorithm constants (e.g., `EASE_FLOOR = 1.3`) at module scope. Create helper functions for repeated numeric operations (e.g., `round2 = (n: number) => Math.round(n * 100) / 100`).
- For date arithmetic, use `Date.UTC()` for timezone-safe operations and return ISO `YYYY-MM-DD` strings. Test with vitest via `describe` + `it` blocks, asserting exact numeric/string outputs.
- **Consecutive streak pattern**: For streak queries, fetch all distinct dates as a Set, then walk backward from `today` via `cursor = addDays(cursor, -1)` while `dates.has(cursor)`, incrementing a counter. Stops at the first gap. Ensure today is included only if an attempt exists for it.
- **External API SDK wrappers**: For LLM or service SDKs (e.g., Anthropic, external APIs), create a thin server-side wrapper in `lib/<domain>/<sdk>.ts` (e.g., `lib/tutor/anthropic.ts`). Export typed interfaces (`TutorTurn`, etc.) and an async function (e.g., `askClaude`) that accepts configuration (apiKey, system, messages) as parameters — never read from environment. Use typed filter guards (e.g., `(block): block is Anthropic.TextBlock => block.type === "text"`) to safely extract response data. This pattern enables testing, keeps secrets server-side only, and avoids client-side SDK imports.

### Aggregate Query Modules (`lib/db/stats.ts`)

- For derived metrics (counts, streaks, latest records), create a dedicated `stats.ts` module. Export typed result interfaces (e.g., `ResumeProblem`) and query functions that take `db: Database.Database`.
- Cast COUNT query results to `{ c: number }` and access `.c` property. For row-returning queries, cast to the result interface and return `row ?? null` for optional single results.
- Test aggregate queries with in-memory databases and seed data via `beforeEach`, asserting numeric/object results exactly.
- **Polymorphic entity filtering in JOINs**: When joining a polymorphic table (e.g., `reviews` storing both problems and patterns) to filter one entity type, use a composite ON clause: `JOIN reviews r ON r.item_type = 'pattern' AND r.item_id = pa.id`. This is clearer than UNION ALL when querying a single entity type and handles LEFT JOINs (yielding nulls for unreviewed entities) more naturally.
- **Multi-level ranking with fallback**: For queries that rank entities by a primary criterion then tie-break by secondary criteria before falling back to a default ordering, use ORDER BY with multiple columns in priority order, then LIMIT 1 for optional results or LIMIT 1 with OFFSET/fallback for guaranteed results. Example: rank patterns by lowest review ease, break ties by earliest due_date, fallback to first pattern by (ordering, name), return null only if no patterns exist. Test all three branches (normal rank, tie-break, fallback, and null cases) separately.

### Markdown & Code Highlighting

- Components rendering markdown use react-markdown with `rehypeHighlight` plugin (syntax highlighting). CSS for `.markdown` is added to `globals.css`, not imported into the component.
- Highlight.js theme (e.g., `github-dark.css`) is imported once in `app/layout.tsx` only, directly after `globals.css`.
- When testing markdown code blocks: `rehypeHighlight` tokenizes code into `<span>` elements, splitting text nodes. Use `container.querySelector("pre code")?.textContent` assertions instead of `getByText()`.
- **XSS safety**: Never add `rehypeRaw`, `skipHtml`, or `allowDangerousHtml` options — `react-markdown` escapes HTML by default. User-generated content (notes, authored markdown) renders safely as escaped text.

### Markdown Section Keys

- When parsing Markdown headers to extract sections, derive `section_key` via `slugify()` — lowercase, collapse non-alphanumeric runs to single hyphens, trim leading/trailing hyphens.
- Content before the first `##` heading is always a leading overview section with hardcoded `key: "overview"` (omitted if empty/whitespace). See `lib/content/sections.ts` for reference.

### Standalone TypeScript Modules (e.g., `mcp/db.ts`)

- For modules run outside the Next.js app via `tsx` (e.g., MCP server, CLI tools), resolve paths relative to the repo root using `import.meta.url`: `const HERE = path.dirname(fileURLToPath(import.meta.url)); export const REPO_ROOT = path.resolve(HERE, "..")`. This works because `tsx` supports ESM and resolves `import.meta.url` correctly at runtime.
- Export module-level constants for shared paths (e.g., `DEFAULT_DB_PATH`, `CONTENT_PATTERNS_DIR`). Accept optional `dbPath` parameters with `process.env.VAR || DEFAULT_CONST` fallback, enabling environment overrides for testing.
- Throw friendly errors for missing resources, mentioning the exact setup command (e.g., `npm run migrate`).
- Test with `beforeEach`/`afterEach` creating temporary directories and in-memory fixtures (e.g., SQLite), not committed fixtures.
- **MCP tool registration**: Create a `registerAll(server, context)` function that registers all tools and prompts on an `McpServer`. Use a context object (e.g., `{ openDb: () => Database, today: () => string }`) to inject dependencies. Wrap each tool handler with a `run()` helper that catches errors, serializes results to JSON text content, and returns `{ content: [...], isError: boolean }` for consistent error handling across the MCP SDK.
- **MCP server entry point**: In `server.ts`, use lazy memoization for the read-only DB connection (module-level `cached` variable, lazily opened on first call). Log only to `console.error` (stderr); stdout must remain clean for the JSON-RPC channel. Import SDK types with `.js` suffixes for ESM.
- **MCP server unit testing**: Use `InMemoryTransport.createLinkedPair()` to test MCP servers in-process: create a linked pair of in-memory transports, connect the server to one and the SDK `Client` to the other. Create an in-memory SQLite database for the test, register tools/prompts, then use the client to call `listTools()`, `listPrompts()`, and `callTool()` to verify behavior. This avoids subprocess overhead while validating the full SDK integration. See `mcp/register.test.ts` for a complete example.
- **Claude Desktop MCP integration**: For user-facing MCP servers, document setup in `mcp/README.md` with verbatim `claude_desktop_config.json` snippet including absolute paths (`cwd` to repo root, `DSA_DB_PATH` env var to the database file). Use `npx tsx mcp/server.ts` as the command. Include troubleshooting for path resolution and connection reopen. Commit both `mcp/README.md` and a brief section in the root `README.md` (before `## License`) explaining the feature and linking to `mcp/README.md`.

### Content Loader Functions

- Content loaders (e.g., `loadPatternContent()`) should accept `slug` and optional `baseDir` parameters, defaulting `baseDir` to `path.join(process.cwd(), "content", "<type>")`.
- Return `string | null` (null if the markdown file is missing). Use `node:fs` and `node:path` only (server-side, no client imports).
- Test loaders with temporary directories via `fs.mkdtempSync()` and `fs.rmSync()` in beforeEach/afterEach blocks, not committed fixtures.

### List Pages (e.g., `/patterns`, `/problems`)

- Server components marked `export const dynamic = "force-dynamic"` that fetch records from the database.
- In Next 15, `searchParams` is a `Promise<...>` — must be awaited before use. Extract filter values via a helper function (e.g., `val(sp, key)`) that safely coerces string-or-array params to strings before passing to query functions.
- Call a query function (e.g., `listPatterns(getDb())`) and render as styled `<Link>` wrappers with `href={"/resource/<slug>"}`.
- Each link displays bold name + muted metadata (status, count, etc.) side-by-side using flexbox.
- Use inline styles with CSS variables (`var(--border)`, `var(--muted)`, `var(--fg)`) for theming consistency.
- **Reusable style objects**: Extract repeated inline style patterns into module-level `const` objects annotated with `as const` (e.g., `const card = { flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" } as const;`). Reuse via object spread: `style={card}` or `style={{ ...card, display: "inline-block" }}`. Keeps styling DRY and composable.
- **Null-guarding numeric/optional fields**: When rendering optional numeric fields (e.g., SRS `interval_days`), use `field != null ? format(field) : fallback` instead of `??`, because `??` would coalesce `0` to the fallback but `0` is a valid value. Reserve `??` for non-numeric optional fields (e.g., `ease ?? "—"`). This ensures 0-valued fields display correctly.
- **Filter form pattern**: For pages with server-side filtering, use `<form method="get">` with selects/inputs carrying `defaultValue={filters.field}` to persist filters across form submissions. Include a "Clear" link (e.g., `href="/problems"`) to reset to the default unfiltered view.

### Detail Pages (e.g., `/patterns/[slug]`)

- Server components (`export const dynamic = "force-dynamic"`) that load a single resource by slug and render its details.
- **Loading scoped secondary resources**: When a detail page loads a scoped resource (e.g., a tutor session per pattern), use defensive chaining: call `find*` to get the scope's resource ID (returns `id | null`), then conditionally load related data or provide an empty default. Example: `const sessionId = findTutorSession(db, "pattern", patternId); const messages = sessionId ? listTutorMessages(db, sessionId) : [];`. This pattern avoids crashes and naturally supports create-on-first-access workflows in subsequent mutations.
- Render secondary sections (e.g., a tutor conversation, related notes) within the main content, before `</main>`, in the order they logically follow the primary content.

### Server Actions (Mutations)

- Place mutation actions in `lib/<domain>/actions.ts` with `"use server"` directive. Accept `formData: FormData` parameter.
- Validate inputs early: trim string fields, coerce numeric fields via `Number()`, check for empty/falsy values, and early-return on guard failure (no-op).
- For enum fields, define a const array of valid values at the module level and validate via `.includes()`: `const OUTCOMES: Outcome[] = ["solved", "partial", "failed"]; ... if (!OUTCOMES.includes(outcome)) return;`. For optional enums, cast to string first, check inclusion, then cast to typed const only if valid.
- For optional numeric fields, use `Number.isFinite()` after coercion to guard against NaN: `const num = Number(str); ... ? (Number.isFinite(num) ? num : null) : null`.
- **Conditional secondary mutations**: If a server action must trigger an optional secondary DB operation based on a validated optional field (e.g., `recordReview` when `rating` is non-null), validate and coerce the optional field early, then check it conditionally before calling the secondary helper: `if (rating) { recordReview(...); }`. This avoids re-parsing and keeps the flow clear.
- Call DB helpers via `getDb()` and always call `revalidatePath(\`/patterns/${slug}\`)` (or equivalent) after a successful mutation for ISR refresh.
- **Context-aware revalidation paths**: When a client component (e.g., a form used across multiple pages) needs ISR refresh, pass the revalidation path as a prop (e.g., `revalidate="/patterns/{slug}"`) rather than hardcoding. The component forwards it via a hidden input to the server action. In the server action, accept the optional revalidate field and use a fallback: `const revalidate = String(formData.get("revalidate") ?? "") || "/default/path"; revalidatePath(revalidate);`.
- **External API failures in server actions**: When calling an external service (e.g., Anthropic, LLM) that may fail, wrap the call in try/catch. On failure, persist a user-visible message (e.g., assistant message, note) to the database instead of returning an error or crashing. For missing configuration (e.g., API key), validate before the call and persist a friendly "configure this in Settings" message. Always call `revalidatePath()` regardless of success or failure to ensure UI stays in sync. See `lib/tutor/actions.ts` for a complete example.

### Client Components (Interactive UI)

- Mark interactive components with `"use client"`. Do NOT import any `lib/db/` helpers, server actions, or `better-sqlite3` — maintain the server-only boundary.
- To integrate with server mutations, receive the action as a **prop** (e.g., `action: (formData: FormData) => void | Promise<void>`). This decouples the component from server code and enables unit testing.
- Client components manage local state (form visibility, selection, input values) via `useState`. Use `<form action={action}>` to submit data; hidden inputs carry derived state or metadata.
- **Popover/toggle form pattern**: For forms toggled by a button, use `useState(false)` for `open`. Conditionally render the form with `{open && <form>}`. Declare all hidden inputs (outcome, rating, etc.) unconditionally inside the form so they persist in the DOM when open; wire them to state via `onChange`. Disable submit until a required field is selected: `disabled={fieldValue === ""}`. This ensures the server receives all data only when intentional.
- **Multi-button server-action form**: For inline forms with multiple mutually-exclusive actions (e.g., rating choices Hard/OK/Easy), use multiple `<button type="submit">` with the same `name` and different `value` attributes. The server reads `formData.get(name)` to detect which button was clicked. No client state needed — inline styles with CSS variables; often used for quick feedback forms.
- Test client components in isolation with `@testing-library/react` and `fireEvent`, passing a no-op action. Under Vitest with `jsdom`, the `"use client"` directive is inert — the component renders as a normal React component. No new testing dependencies needed.
