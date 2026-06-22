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
