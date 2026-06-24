# DSA Trainer

A local, single-user app for getting back into competitive- and interview-level
data-structures-and-algorithms shape. It brings together three things that
usually live in separate places:

1. **Deep study material** — comprehensive, editable guides for each algorithmic
   *pattern* (sliding window, binary search, topological sort, …), read as the
   primary mode of learning.
2. **Practice tracking** — every LeetCode attempt logged against a curated
   problem set, with status and history. Problems deep-link out to leetcode.com;
   you log the result back here.
3. **Scheduled review** — a spaced-repetition engine (SM-2) that decides *what to
   refresh today* so knowledge stays interview-ready.

Plus a typed **AI tutor** per topic — ask questions, get quizzed, or explain a
concept back (Feynman-style "teach it back") and have it tell you what you missed.

> **Status:** All build phases (0–5) are complete. The app runs with navigation,
> a database, and a Settings screen; a pattern reading experience with
> syntax-highlighted content and section-level notes; practice tracking — a
> filterable Problems board and a reusable log-attempt popover; spaced repetition
> — SM-2 scheduling, a Review queue, and a Today screen with streak, stats, an
> activity heatmap, and a weakest-retention "study a pattern" suggestion; an AI
> tutor on each pattern page (grounded in that pattern's notes, with a "Teach it
> back" mode) backed by your Anthropic API key; and a Stats screen with a
> solved-by-difficulty breakdown and per-pattern mastery. See the
> [Roadmap](#roadmap) for what's intentionally deferred.

## Tech stack

- **Next.js** (App Router, TypeScript) — one app serving the UI and a small set
  of server-side API routes / server actions.
- **SQLite** via `better-sqlite3` — all progress data, with a tiny hand-written
  migration runner.
- **Markdown** — study content lives as plain files on disk, rendered with
  syntax-highlighted code.
- **Vitest** + Testing Library — unit and component tests.

All database access is server-side only; the Anthropic API key is stored locally
and never sent to the browser or committed to git.

## Getting started

Requires Node.js 20+ (developed on Node 24).

```bash
npm install      # install dependencies (builds the native better-sqlite3 module)
npm run migrate  # create the SQLite schema at data/dsa.sqlite
npm run seed     # insert sample patterns, problems, and their links
npm run dev      # start the app at http://localhost:3000
```

To use the AI tutor, open **Settings** and paste your Anthropic API key — it is
stored in the local database, server-side only.

### Scripts

| Command           | Description                                              |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Start the dev server on `localhost:3000`.               |
| `npm run build`   | Production build.                                       |
| `npm start`       | Run the production build.                               |
| `npm test`        | Run the test suite once (Vitest).                       |
| `npm run test:watch` | Run tests in watch mode.                             |
| `npm run migrate` | Apply any pending SQL migrations.                       |
| `npm run seed`    | Insert sample data (idempotent).                        |

## How it works

- **Patterns** are techniques. Each owns rich study content, your inline notes, a
  status, and its own review schedule.
- **Problems** are concrete LeetCode problems, mapped to one or more patterns,
  with attempt history and their own review schedule.
- **Attempts** record an outcome (solved / partial / failed), a self-rating, time,
  hint usage, and an optional reflection. They drive both status and scheduling.
- **Reviews** hold the SM-2 state (ease, interval, due date). *Both* problems and
  patterns are reviewable, with independent schedules — a problem review means
  *re-solve it*, a pattern review means *recall + teach it back*.

## Project structure

```
app/                 Next.js App Router pages
  (shell)/           the persistent left-nav layout and its routes
  layout.tsx         root layout + global styles
components/           UI components (e.g. NavRail)
lib/
  db/                SQLite connection, migration runner, helpers
    migrations/      ordered .sql schema migrations
  settings/          server actions
scripts/             migrate / seed CLI entrypoints
docs/superpowers/    design spec and phase implementation plans
```

The full design lives in
[`docs/superpowers/specs/`](docs/superpowers/specs/2026-06-21-dsa-trainer-design.md);
phase-by-phase implementation plans live in
[`docs/superpowers/plans/`](docs/superpowers/plans/).

## Roadmap

- [x] **Phase 0 — Skeleton.** Next.js + SQLite, migration runner + schema, seed
  data, app shell with navigation, Settings screen persisting the API key.
- [x] **Phase 1 — Content & reading.** Pattern list/detail, Markdown rendering,
  section-level inline notes.
- [x] **Phase 2 — Tracking.** Problems board with filters and the reusable
  log-attempt popover; attempt history and status.
- [x] **Phase 3 — Spaced repetition.** SM-2 scheduling, the due queue, and the
  Today screen (resume, quick-study, stats).
- [x] **Phase 4 — AI tutor.** Tutor chat per topic, persisted sessions, and
  teach-it-back wired into pattern review.
- [x] **Phase 5 — Polish.** Activity heatmap on Today, weakest-retention
  "study a pattern" suggestion, and a Stats screen (solved-by-difficulty +
  per-pattern mastery).

All build phases are complete. **Intentionally deferred** (nice-to-haves, not
yet built): streaming tutor replies, a problem-scoped tutor, wiring "teach it
back" into the SRS rating, and a two-column pattern-page layout.

The deep study content (the actual per-pattern guides) is authored as a separate,
incremental track once the app is running — not part of the build phases.

## License

Personal project. No license granted yet.
