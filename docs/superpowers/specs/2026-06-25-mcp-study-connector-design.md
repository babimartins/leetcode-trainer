# DSA Trainer — Study Connector (MCP) Design

**Status:** Approved design, ready for implementation planning.
**Date:** 2026-06-25
**Author:** Barbara + Claude (brainstorming session)

## 1. Overview

A local **Model Context Protocol (MCP) server** — the "study connector" — that
exposes the DSA Trainer study database to the **Claude desktop app**. When
Barbara asks Claude a question about her lists or topics (e.g. "what am I
weakest on?", "what's still unsolved in the sliding-window list?", "explain the
pattern behind Koko Eating Bananas using my notes"), Claude calls the connector,
which reads the **live** study database read-only and returns real data; Claude
answers grounded in it.

Because the connector reads the SQLite file on each request, it is automatically
current: as Barbara studies in the app (logging attempts, adding notes, recording
reviews), her next question to Claude reflects the new state — no exporting, no
copy-paste. It runs locally over stdio and uses her existing Claude Pro/Max
subscription, so it costs **no API credits**.

This replaces the need for the (deferred) in-app AI tutor for the day-to-day
"ask Claude about my studies" use case. The in-app tutor (Phase 4) remains as
built; this connector is the preferred path because it is free on the
subscription and always live.

## 2. Goals / Non-Goals

**Goals**
- Let Claude (desktop app) answer questions about Barbara's patterns, problems,
  statuses, weak areas, due reviews, notes, attempts, stats, and topic material.
- Always reflect current study state with no manual sync.
- Run locally, no network exposure, no auth, no API credits.
- Reuse the app's existing `lib/db/*` query code so answers match the app exactly.
- Ship a "study buddy" persona so Claude behaves as a Socratic tutor by default.

**Non-Goals (this version)**
- **No writes.** Claude cannot log attempts, add notes, record reviews, or change
  statuses. Read-only is enforced at the database connection. (Write actions are a
  deliberate future phase.)
- No remote/hosted access (claude.ai web connectors, OAuth, multi-user). Local
  stdio only.
- No authoring of per-pattern study content (separate track). The connector reads
  whatever content exists; it grows more useful as content is written.
- No one-click installer (`.mcpb` Desktop Extension) in v1 — a hand-edited config
  entry is the setup. The extension packaging is a possible later nicety.

## 3. Architecture

- **Location:** a new top-level `mcp/` folder inside the existing repo, so it can
  import the app's `lib/db/*` and `lib/content/*` modules directly (DRY — one
  source of truth for queries).
- **Process model:** a standalone Node/TypeScript process, separate from the
  Next.js app. It does **not** require the dev server to be running; it reads the
  database file directly.
- **Transport:** MCP over **stdio** via the official `@modelcontextprotocol/sdk`.
  The Claude desktop app spawns the process and communicates over stdin/stdout.
  No port, no network listener, no auth — appropriate for a single-user local tool.
- **Database access:** opens `data/dsa.sqlite` with `better-sqlite3` in
  **read-only mode** (`new Database(path, { readonly: true })`). Writing is
  impossible by construction. The connector uses its own read-only connection
  (the app's `getDb()` singleton is per-process and not shared across processes).
  The DB path is resolved from an env var (`DSA_DB_PATH`) with a sensible default
  of `<repo>/data/dsa.sqlite`.
- **Run command:** invoked via `tsx` (already a dev dependency used by the
  migrate/seed scripts), e.g. `npx -y tsx <repo>/mcp/server.ts`, so there is no
  separate build step. (A compiled `dist` build or `.mcpb` packaging is a future
  option if startup robustness ever warrants it.)
- **New dependency:** `@modelcontextprotocol/sdk` (latest). No other runtime deps
  beyond what the app already has (`better-sqlite3`).

### File structure (planned)

```
mcp/
  server.ts            MCP server entry: registers tools + the prompt, starts stdio transport
  db.ts                opens data/dsa.sqlite read-only; resolves DSA_DB_PATH
  tools/               one module per tool (or grouped), each a pure handler over a db handle
  queries.ts           thin NEW read queries not yet in lib/db (recent attempts, all notes, problem search)
  persona.ts           the study-buddy starter-prompt text (reuses lib/tutor/prompt framing)
  *.test.ts            Vitest unit tests per tool against a seeded temp DB
```

## 4. Tools (read-only)

Eight curated tools, grouped by purpose. Each returns clean structured data plus,
where useful, underlying text (a pattern's material, note bodies) so Claude can
both reason about progress and teach from the actual material. "Reuses" names the
existing helper; "new" marks a small new query.

**Knowing where you stand**
- `study_stats` — overview: problems solved (and `solvedByDifficulty`), total
  attempts (`totalAttempts`), current streak (`currentStreak`), due count
  (`dueCount`), patterns started (`patternsProgress`). *Reuses `lib/db/stats.ts`,
  `lib/db/statsPage.ts`.*
- `weakest_patterns` — patterns ranked by weakest retention (lowest ease / most
  overdue). *Reuses/generalizes `lib/db/weakest.ts` + `patternMastery`.*
- `due_for_review` — items due today (problems and patterns) per SM-2.
  *Reuses `getDueItems` (`lib/db/reviews.ts`).*
- `recent_activity` — last N attempts: problem, outcome, self-rating, date.
  *New query (`listRecentAttempts(db, limit)`).*

**Digging into topics**
- `list_patterns` — every pattern with status and mastery (ease, interval, due,
  weak/strong). *Reuses `listPatterns` + `patternMastery`.*
- `get_pattern` — one pattern by slug/name: its study material
  (`loadPatternContent`), the learner's notes (`listNotesForPattern`), and the
  problems mapped to it with status/attempts (`listProblemsForPattern`).
  *Reuses `lib/content/loadPattern.ts`, `lib/db/notes.ts`,
  `lib/db/problemsForPattern.ts`, `getPatternBySlug`.*
- `list_notes` — the learner's notes, optionally filtered by pattern.
  *Reuses `listNotesForPattern`; new `listAllNotes(db)` for the unfiltered case.*

**Working the lists**
- `list_problems` — the problem board filterable by status / difficulty / pattern /
  keyword, with attempt summary. *Reuses `listProblems` (`lib/db/problemsList.ts`),
  extended with an optional keyword filter if not already present.*

Tool inputs are validated; unknown identifiers return a helpful message (see §6).

## 5. Behavior — the study-buddy persona

The connector also exposes **one MCP prompt**, `study_session`, which the Claude
desktop app surfaces under "DSA Trainer". Selecting it primes Claude with the
Socratic-tutor persona — patient, grounds every answer in the learner's data via
the tools, quizzes, corrects gently, stays concise, no emoji — reusing the same
framing as the app's existing `buildTutorSystem` (`lib/tutor/prompt.ts`).

This gives the clean split discussed in design:
- **Tools = the living context** (the data, always current).
- **Prompt = the stable "skill"** (how to behave).

Optionally, Barbara can paste the same persona text into a Claude **Project's**
custom instructions once to make it always-on for that project; the MCP prompt is
the zero-setup default.

## 6. Error handling

- **DB missing / wrong path:** every tool returns a plain-language error
  ("study database not found at `<path>`; run `npm run migrate` in the app")
  rather than throwing/crashing the server.
- **Read-only safety:** enforced at the connection (`readonly: true`) — writes are
  impossible regardless of what Claude is asked to do.
- **Unknown pattern/problem:** returns a helpful nudge ("no pattern named `X` —
  try `list_patterns`").
- **No authored material yet:** `get_pattern` returns a clear "no study material
  yet for `X`" note, mirroring the app's own behavior, alongside any notes and
  mapped problems that do exist.

## 7. Testing

- **Per-tool unit tests:** each of the 8 tools is tested against a temporary
  seeded SQLite database using the project's existing Vitest + in-memory/temp-DB
  conventions (create tables inline, seed via `beforeEach`, assert exact returned
  shapes). New queries (`listRecentAttempts`, `listAllNotes`, problem keyword
  search) get their own tests.
- **Smoke test:** the server boots and advertises exactly the 8 tools + 1 prompt.
- **Read-only test:** opening the DB read-only and attempting a write throws (the
  guarantee is verified, not assumed).
- All tests run under `npm test` alongside the app's existing suite.

## 8. Claude Desktop setup (one-time)

1. Install the free Claude desktop app and sign in with the Pro/Max account.
2. Add an entry to `claude_desktop_config.json` (exact snippet generated during
   implementation), of the form:

   ```json
   {
     "mcpServers": {
       "dsa-trainer": {
         "command": "npx",
         "args": ["-y", "tsx", "/Users/barbarad/Documents/LeetCode/dsa-trainer/mcp/server.ts"],
         "env": { "DSA_DB_PATH": "/Users/barbarad/Documents/LeetCode/dsa-trainer/data/dsa.sqlite" }
       }
     }
   }
   ```
3. Restart Claude desktop; "DSA Trainer" appears as a connector with its tools and
   the `study_session` prompt.

The exact command/paths are finalized in the implementation plan (and a
`README`/`docs` note will capture them).

## 9. Scope & phasing

- **This spec (v1):** read-only connector, 8 tools, 1 persona prompt, local stdio,
  Claude Desktop, tests, setup docs.
- **Future (not now):** write actions (log attempt / add note / record review /
  set status) with per-action confirmation; a guarded read-only generic `query`
  escape hatch; `.mcpb` one-click packaging; remote/hosted access for claude.ai
  web. These are explicitly out of scope here.

## 10. Open questions

None blocking. Content richness is the main external dependency (the connector
gets more valuable as per-pattern study material is authored), but it is useful
immediately for lists, statuses, weak areas, notes, attempts, and stats.
