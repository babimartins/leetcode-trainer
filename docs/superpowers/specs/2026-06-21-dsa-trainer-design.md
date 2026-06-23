# DSA Trainer — Design Document

**Date:** 2026-06-21
**Status:** Approved design, pre-implementation
**Owner:** Barbara

## 1. Purpose

A local, single-user app for getting back into competitive/interview-level
data-structures-and-algorithms shape. It unifies three things that usually live
in separate places:

1. **Deep study material** — comprehensive, co-authored guides for each
   algorithmic *pattern*, read as the primary mode of learning.
2. **Practice tracking** — every LeetCode attempt logged against a curated
   problem set, with status and history.
3. **Scheduled review** — a spaced-repetition engine that decides *what to
   refresh today* so knowledge stays interview-ready.

Plus an **AI tutor** per topic, because Barbara learns well by talking ideas
through and being challenged (Feynman / teach-it-back).

## 2. Core concepts

- **Pattern** — a technique (e.g. Sliding Window, Binary Search on Answer,
  Topological Sort). Owns rich Markdown study content, inline personal notes,
  a status, and its own review schedule.
- **Problem** — a concrete LeetCode problem. Has metadata (title, difficulty,
  LC URL, source list), is mapped to one or more patterns, deep-links out to
  leetcode.com, and carries status + attempt history + a review schedule.
- **Attempt** — a logged outcome for a problem (solved / partial / failed,
  self-rating, time, hint used, optional reflection). Drives status and SRS.
- **Review** — SRS state (ease, interval, due date) attached to a reviewable
  item. Both problems and patterns are reviewable, with independent schedules.
- **Tutor session** — a saved AI conversation attached to a pattern or problem.

## 3. Architecture

A single **Next.js** app, run locally with `npm run dev`, served at
`localhost:3000`.

- **Frontend + backend in one process.** Next.js API routes handle: logging
  attempts, computing the review queue, and proxying AI-tutor calls to the
  Anthropic API (the API key stays server-side, never reaches the browser).
- **SQLite** holds all *progress* data (problems, attempts, reviews, notes,
  tutor sessions). Accessed via a thin data layer (`better-sqlite3` or Prisma —
  decided at planning time).
- **Markdown files on disk** hold the *study content* (one file per pattern).
  Version-controllable, editable in any editor, rendered with syntax
  highlighting. Content is co-authored over time; the app ships the container
  and we fill patterns in incrementally.
- **Config:** the Anthropic API key is provided via a local `.env` / settings
  screen and never committed.

Rationale: one language (TypeScript) end to end, minimal boilerplate, trivial
Markdown rendering, a single command to start studying.

## 4. Data model (SQLite)

- `patterns` — id, name, slug, content_path, status, ordering, created_at.
- `problems` — id, title, lc_slug, lc_url, difficulty, status, created_at.
- `sources` / `problem_sources` — named lists (Blind 75, NeetCode 150, custom)
  and their membership (many-to-many).
- `problem_patterns` — problem ↔ pattern mapping (many-to-many).
- `attempts` — id, problem_id, date, outcome (solved/partial/failed),
  rating (hard/ok/easy), minutes, used_hint (bool), reflection (text).
- `notes` — id, pattern_id, section_key (the stable section anchor), body,
  created_at, updated_at. (Section-level anchoring — see §6.)
- `reviews` — id, item_type (problem|pattern), item_id, ease, interval_days,
  due_date, last_reviewed. One row per reviewable item.
- `tutor_sessions` — id, scope_type (pattern|problem), scope_id, title,
  created_at.
- `tutor_messages` — id, session_id, role (user|assistant), content, created_at.
- `app_state` — small key/value for "resume where I left off" and settings.

## 5. Spaced-repetition rules (SM-2, lightly adapted)

- After logging an attempt (problem) or a recall session (pattern), the
  self-rating maps to an SM-2 quality score.
- **Easy** lengthens the interval (× higher factor), **OK** moderate growth,
  **Hard** advances the interval only slightly (×1.2) and lowers ease so future
  growth is gentler. (Decided in Phase 3: "Hard" means "got it but it was tough,"
  not a full reset — Anki "Hard"-like rather than "Again"-like.)
- A reviewable item is **due** when `due_date <= today`. The Today screen and
  Review queue surface due items.
- **The computed interval is deliberately NOT shown on the rating buttons** —
  it could bias honest self-assessment.
- Problems and patterns schedule independently. "Weakest retention" (used by
  the home Quick-study suggestion) ranks patterns by low ease / long overdue.

## 6. Study content & notes

- **Content** is per-pattern Markdown with a consistent section structure:
  *Intuition · When to reach for it (trigger) · Template (with code) ·
  Complexity · Common pitfalls · Worked example*. Co-authored, leaning on
  canonical sources (NeetCode roadmap, CP-Algorithms) for coverage.
- **Notes are section-level.** Each rendered section has a stable `section_key`
  (derived from its heading). A note stores `(pattern_id, section_key, body)`
  and renders as a highlighted inline block within that section. This never
  breaks when prose inside the section is edited. (A future enhancement —
  highlight-a-phrase anchoring — can layer on the same records.)

## 7. AI tutor

- Typed chat (no voice). Lives in the right panel of the pattern detail screen
  and is also reachable from problems.
- Scoped to the current pattern/problem: the relevant Markdown content is
  included as context so the tutor is grounded in the same material.
- Modes: free Q&A, quizzing, and **"Teach it back"** — the tutor asks Barbara
  to explain the technique, then identifies gaps. A teach-it-back session can
  serve as a pattern review and feed its SRS rating.
- Backed by the Anthropic API (latest Claude model) via a server-side route.
  Sessions and messages are persisted.

## 8. Screens

1. **Today (home)** — greeting + streak; **Resume where you left off** card
   (last active reading/problem/tutor context); **Study a pattern** quick
   action with a weakest-retention suggestion; three stats (due / solved /
   patterns started); the **due-today queue**; a 13-week **activity heatmap**.
2. **Patterns** — list of patterns with status, into:
   **Pattern detail** — deep reading content (main column) with inline notes;
   **Review this pattern** + **Teach it back** actions; the **tutor** panel;
   and an interactive **mapped-problems** strip (click → log popover).
3. **Problems board** — filterable table (search + pattern / difficulty /
   list / status), columns for difficulty, pattern, status, next-review;
   row click → log popover; "···" quick menu (open on LeetCode, edit pattern
   mapping, reset progress).
4. **Review queue** — runs through all due items one at a time (problem =
   re-solve/recall; pattern = recall + optional teach-it-back), rate, reschedule.
5. **Stats** — progress over time, per-pattern mastery, heatmap (later phase).
6. **Settings** — Anthropic API key, source lists, data location.

### Reusable components
- **Log-attempt popover** — outcome, how-it-felt rating, time, hint, reflection.
  One component reused on the pattern strip, the board, and the review queue.
- **Problem chip** — status-colored, deep-links to LeetCode.

## 9. Style

- Clean, restrained UI. **No face emojis.** Plain text labels on controls.
  (Open: whether to keep non-face glyphs like the streak/notes icons.)
- Don't surface SRS internals (intervals) on rating controls.

## 10. Out of scope (v1, YAGNI)

- No auto-sync with LeetCode submissions (manual logging + deep links only).
- No voice/speech.
- No multi-user / accounts / cloud sync.
- No mobile app (local desktop browser only).
- Highlight-a-phrase note anchoring — deferred.

## 11. Phased build plan

- **Phase 0 — Skeleton:** Next.js app, SQLite + data layer, schema migrations,
  nav shell, Settings (API key). Seed a couple of patterns + a small problem set.
- **Phase 1 — Content & reading:** Pattern list + detail, Markdown rendering
  with code highlighting, section-level notes. Uses minimal **sample/placeholder**
  Markdown only — enough to exercise rendering, sections, and notes. Writing the
  real deep guides is a **separate authoring track** done after the app runs,
  not part of this build plan.
- **Phase 2 — Tracking:** Problems board, log-attempt popover, attempt history,
  status. (No SRS scheduling yet — status views work on the same data.)
- **Phase 3 — Spaced repetition:** Reviews table + SM-2, due queue, Today
  screen (resume, quick-study, stats, due list), Review queue flow.
- **Phase 4 — AI tutor:** Server route to Anthropic, tutor panel, persisted
  sessions, Teach-it-back wired to pattern review.
- **Phase 5 — Polish:** Activity heatmap, Stats screen, weakest-retention
  suggestion, refinements.

Each phase is independently usable. **Decision:** the build plan covers the app
only; it ships with sample/placeholder content. All deep study content is
authored separately, pattern by pattern, once the app is running. Patterns
coverage (which patterns, in what order) is its own planning conversation and
does not block the build.

## 12. Open questions

- Keep or drop non-face emojis/glyphs across the UI.
- Data-layer choice: `better-sqlite3` (lighter) vs Prisma (typed/migrations).
- Which pattern set and problem lists to seed first (separate discussion).
