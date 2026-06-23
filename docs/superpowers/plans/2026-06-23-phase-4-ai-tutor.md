# DSA Trainer — Phase 4 (AI Tutor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed AI tutor to each pattern page — grounded in that pattern's study content — that answers questions, quizzes, and runs a "teach it back" session, with the conversation persisted.

**Architecture:** A thin server-side `askClaude` wrapper calls the Anthropic API (`@anthropic-ai/sdk`, model `claude-opus-4-8`, non-streaming) using the API key stored in `app_state`. A `sendTutorMessageAction` server action loads the pattern's Markdown content, builds a grounding system prompt, appends the user message to the persisted conversation, calls Claude, and persists the reply. A `TutorPanel` client component renders the conversation and an input (plus a "Teach it back" button) on the pattern detail page. Tutor sessions and messages use the `tutor_sessions` / `tutor_messages` tables that already exist from Phase 0.

**Tech Stack:** Next.js (App Router, TS), better-sqlite3, `@anthropic-ai/sdk`, a React client component + server action, Vitest.

## Global Constraints

- Runs locally via `npm run dev` on localhost:3000. Single user, no auth.
- TypeScript everywhere; App Router; DB access server-side only; `better-sqlite3` never imported into a client component. `@anthropic-ai/sdk` is imported only by server code (the wrapper + action), never by a client component.
- No face emojis in UI; plain text labels.
- **Tutor model: `claude-opus-4-8`** (exact string, no date suffix), non-streaming, `max_tokens: 16000`. Do NOT set `temperature`/`top_p`/`top_k` or `thinking.budget_tokens` — those 400 on Opus 4.8. Omit the `thinking` parameter (runs without extended thinking — fine for a low-latency tutor chat).
- **API key** is read from the `app_state` table under the key `anthropic_api_key` (written by the Settings screen, Phase 0). It is used only server-side and never sent to the browser or committed.
- Tutor is **scoped to a pattern**: `tutor_sessions.scope_type = 'pattern'`, `scope_id = pattern.id`. One session per pattern (reused across turns).
- Reuse existing helpers/patterns: `getDb()`, `getAppState` (lib/db/appState.ts), `getPatternBySlug` (lib/db/patterns.ts), `loadPatternContent` (lib/content/loadPattern.ts), the data-helper convention, the server-action pattern (lib/notes/actions.ts), and the client-component-receives-action-as-prop pattern (components/LogAttemptForm.tsx).
- All SQL parameterized.

---

## File Structure

- `package.json` — add `@anthropic-ai/sdk` dependency.
- `lib/tutor/anthropic.ts` — `askClaude` wrapper (server-only).
- `lib/db/tutor.ts` — `findTutorSession`, `getOrCreateTutorSession`, `listTutorMessages`, `addTutorMessage` + types.
- `lib/db/tutor.test.ts` — unit tests.
- `lib/tutor/prompt.ts` — `buildTutorSystem` (pure).
- `lib/tutor/prompt.test.ts` — unit tests.
- `lib/tutor/actions.ts` — `sendTutorMessageAction` server action.
- `components/TutorPanel.tsx` — client component (conversation + input + teach-it-back).
- `components/TutorPanel.test.tsx` — component test.
- `app/(shell)/patterns/[slug]/page.tsx` — render `TutorPanel` (modify).

---

## Task 1: Add the SDK + the askClaude wrapper

**Files:**
- Create: `lib/tutor/anthropic.ts`
- Modify: `package.json` (add dependency)

**Interfaces:**
- Produces:
  - `interface TutorTurn { role: "user" | "assistant"; content: string }`
  - `askClaude(opts: { apiKey: string; system: string; messages: TutorTurn[] }): Promise<string>` — calls the Anthropic Messages API (model `claude-opus-4-8`, non-streaming) and returns the assistant's text (the concatenation of text blocks, or the first text block).

- [ ] **Step 1: Add the dependency**

Run: `npm install @anthropic-ai/sdk@^0.70.0`
Expected: package added, `npm install` exits 0. (If that exact version is unavailable, install the latest `0.x`/`1.x` and proceed — the `messages.create` shape used here is stable.)

- [ ] **Step 2: Implement the wrapper**

`lib/tutor/anthropic.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askClaude(opts: {
  apiKey: string;
  system: string;
  messages: TutorTurn[];
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: opts.system,
    messages: opts.messages,
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
```

- [ ] **Step 3: Type-check**

Run: `node node_modules/typescript/bin/tsc --noEmit` (do NOT use `npx tsc` — it installs a bogus package)
Expected: exit 0.

- [ ] **Step 4: Run the full suite (unchanged)**

Run: `npm test`
Expected: existing suites pass (no new tests this task).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/tutor/anthropic.ts
git commit -m "feat: add Anthropic SDK and askClaude tutor wrapper"
```

---

## Task 2: Tutor data helpers (TDD)

**Files:**
- Create: `lib/db/tutor.ts`, `lib/db/tutor.test.ts`

**Interfaces:**
- Consumes: a `Database.Database`. Tests create `tutor_sessions` and `tutor_messages` tables inline.
- Produces:
  - `type TutorScope = "pattern" | "problem"`
  - `interface TutorMessageRow { id: number; session_id: number; role: string; content: string }`
  - `findTutorSession(db, scope: TutorScope, scopeId: number): number | null` — the existing session id for the scope, or null.
  - `getOrCreateTutorSession(db, scope: TutorScope, scopeId: number): number` — returns the existing session id, or creates one and returns its id.
  - `listTutorMessages(db, sessionId: number): TutorMessageRow[]` — ordered by id ascending.
  - `addTutorMessage(db, sessionId: number, role: "user" | "assistant", content: string): TutorMessageRow` — inserts and returns the created row.

- [ ] **Step 1: Write the failing tests**

`lib/db/tutor.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  findTutorSession,
  getOrCreateTutorSession,
  listTutorMessages,
  addTutorMessage,
} from "./tutor";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE tutor_sessions (id INTEGER PRIMARY KEY,
      scope_type TEXT NOT NULL, scope_id INTEGER NOT NULL, title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE tutor_messages (id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
});

describe("tutor sessions", () => {
  it("findTutorSession returns null when none exists", () => {
    expect(findTutorSession(db, "pattern", 1)).toBeNull();
  });

  it("getOrCreateTutorSession creates once and reuses", () => {
    const a = getOrCreateTutorSession(db, "pattern", 1);
    const b = getOrCreateTutorSession(db, "pattern", 1);
    expect(a).toBe(b);
    expect(findTutorSession(db, "pattern", 1)).toBe(a);
    const count = (
      db.prepare("SELECT COUNT(*) AS c FROM tutor_sessions").get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("keeps sessions distinct per scope", () => {
    const p = getOrCreateTutorSession(db, "pattern", 1);
    const q = getOrCreateTutorSession(db, "problem", 1);
    expect(p).not.toBe(q);
  });
});

describe("tutor messages", () => {
  it("adds and lists messages in order", () => {
    const sid = getOrCreateTutorSession(db, "pattern", 1);
    const m1 = addTutorMessage(db, sid, "user", "explain sliding window");
    expect(m1.id).toBeGreaterThan(0);
    addTutorMessage(db, sid, "assistant", "It maintains a contiguous window...");
    const rows = listTutorMessages(db, sid);
    expect(rows.map((r) => `${r.role}:${r.content}`)).toEqual([
      "user:explain sliding window",
      "assistant:It maintains a contiguous window...",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/db/tutor.test.ts`
Expected: FAIL — cannot find `./tutor`.

- [ ] **Step 3: Implement the helpers**

`lib/db/tutor.ts`:
```ts
import type Database from "better-sqlite3";

export type TutorScope = "pattern" | "problem";

export interface TutorMessageRow {
  id: number;
  session_id: number;
  role: string;
  content: string;
}

export function findTutorSession(
  db: Database.Database,
  scope: TutorScope,
  scopeId: number
): number | null {
  const row = db
    .prepare(
      "SELECT id FROM tutor_sessions WHERE scope_type = ? AND scope_id = ? ORDER BY id LIMIT 1"
    )
    .get(scope, scopeId) as { id: number } | undefined;
  return row ? row.id : null;
}

export function getOrCreateTutorSession(
  db: Database.Database,
  scope: TutorScope,
  scopeId: number
): number {
  const existing = findTutorSession(db, scope, scopeId);
  if (existing !== null) return existing;
  const info = db
    .prepare("INSERT INTO tutor_sessions (scope_type, scope_id) VALUES (?, ?)")
    .run(scope, scopeId);
  return Number(info.lastInsertRowid);
}

export function listTutorMessages(
  db: Database.Database,
  sessionId: number
): TutorMessageRow[] {
  return db
    .prepare(
      "SELECT id, session_id, role, content FROM tutor_messages WHERE session_id = ? ORDER BY id"
    )
    .all(sessionId) as TutorMessageRow[];
}

export function addTutorMessage(
  db: Database.Database,
  sessionId: number,
  role: "user" | "assistant",
  content: string
): TutorMessageRow {
  const info = db
    .prepare(
      "INSERT INTO tutor_messages (session_id, role, content) VALUES (?, ?, ?)"
    )
    .run(sessionId, role, content);
  return db
    .prepare(
      "SELECT id, session_id, role, content FROM tutor_messages WHERE id = ?"
    )
    .get(info.lastInsertRowid) as TutorMessageRow;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/tutor.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/tutor.ts lib/db/tutor.test.ts
git commit -m "feat: add tutor session and message data helpers"
```

---

## Task 3: Tutor system prompt builder (TDD)

**Files:**
- Create: `lib/tutor/prompt.ts`, `lib/tutor/prompt.test.ts`

**Interfaces:**
- Produces: `buildTutorSystem(patternName: string, content: string): string` — a system prompt that establishes a Socratic CS-interview tutor, names the pattern, embeds the study material, and instructs grounding + concise teaching. Falls back to a clear "no study material yet" note when `content` is empty.

- [ ] **Step 1: Write the failing tests**

`lib/tutor/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTutorSystem } from "./prompt";

describe("buildTutorSystem", () => {
  it("names the pattern and embeds the study material", () => {
    const s = buildTutorSystem("Sliding Window", "## Intuition\nSlide a window.");
    expect(s).toContain("Sliding Window");
    expect(s).toContain("Slide a window.");
    expect(s.toLowerCase()).toContain("tutor");
  });

  it("notes when there is no study material", () => {
    const s = buildTutorSystem("Sliding Window", "");
    expect(s).toContain("Sliding Window");
    expect(s.toLowerCase()).toContain("no study material");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/tutor/prompt.test.ts`
Expected: FAIL — cannot find `./prompt`.

- [ ] **Step 3: Implement the builder**

`lib/tutor/prompt.ts`:
```ts
export function buildTutorSystem(patternName: string, content: string): string {
  const material = content.trim()
    ? `--- STUDY MATERIAL: ${patternName} ---\n${content.trim()}\n--- END STUDY MATERIAL ---`
    : `(There is no study material for ${patternName} yet. Teach from your own knowledge, and say so if asked for specifics from the notes.)`;

  return [
    `You are a patient, Socratic computer-science tutor helping a learner master the "${patternName}" algorithmic pattern for coding interviews.`,
    `Ground your teaching in the study material below. When the learner is wrong, correct them gently and point to the specific idea they missed.`,
    `Prefer asking a guiding question or having the learner explain a concept back over lecturing. Keep replies concise and focused. Use plain text and short code snippets; do not use emoji.`,
    ``,
    material,
  ].join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/tutor/prompt.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tutor/prompt.ts lib/tutor/prompt.test.ts
git commit -m "feat: add tutor system prompt builder"
```

---

## Task 4: Tutor server action

**Files:**
- Create: `lib/tutor/actions.ts`

**Interfaces:**
- Consumes: `getDb()`, `getAppState` (lib/db/appState.ts), `getPatternBySlug` (lib/db/patterns.ts), `loadPatternContent` (lib/content/loadPattern.ts), `getOrCreateTutorSession`/`listTutorMessages`/`addTutorMessage` (Task 2), `buildTutorSystem` (Task 3), `askClaude`/`TutorTurn` (Task 1), `revalidatePath`.
- Produces: `sendTutorMessageAction(formData: FormData): Promise<void>` — reads `slug` and `body`; no-ops on empty input or unknown slug. Persists the user message, then: if no API key is set, persists a "set your key in Settings" assistant message; otherwise builds the grounded system prompt + full history, calls `askClaude`, and persists the reply (persisting a friendly error message if the call throws). Always `revalidatePath("/patterns/" + slug)`.

- [ ] **Step 1: Implement the server action**

`lib/tutor/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connection";
import { getAppState } from "@/lib/db/appState";
import { getPatternBySlug } from "@/lib/db/patterns";
import { loadPatternContent } from "@/lib/content/loadPattern";
import {
  getOrCreateTutorSession,
  listTutorMessages,
  addTutorMessage,
} from "@/lib/db/tutor";
import { buildTutorSystem } from "@/lib/tutor/prompt";
import { askClaude, type TutorTurn } from "@/lib/tutor/anthropic";

export async function sendTutorMessageAction(
  formData: FormData
): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!slug || body === "") return;

  const db = getDb();
  const pattern = getPatternBySlug(db, slug);
  if (!pattern) return;

  const sessionId = getOrCreateTutorSession(db, "pattern", pattern.id);
  addTutorMessage(db, sessionId, "user", body);

  const apiKey = getAppState(db, "anthropic_api_key");
  if (!apiKey) {
    addTutorMessage(
      db,
      sessionId,
      "assistant",
      "No Anthropic API key is set. Add one in Settings to chat with the tutor."
    );
    revalidatePath("/patterns/" + slug);
    return;
  }

  const system = buildTutorSystem(pattern.name, loadPatternContent(slug) ?? "");
  const history: TutorTurn[] = listTutorMessages(db, sessionId).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  let reply: string;
  try {
    reply = await askClaude({ apiKey, system, messages: history });
  } catch {
    reply =
      "Sorry — the tutor request failed. Check your API key in Settings and try again.";
  }

  addTutorMessage(db, sessionId, "assistant", reply || "(no response)");
  revalidatePath("/patterns/" + slug);
}
```

- [ ] **Step 2: Type-check**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Run the full suite (unchanged)**

Run: `npm test`
Expected: existing suites pass.

- [ ] **Step 4: Commit**

```bash
git add lib/tutor/actions.ts
git commit -m "feat: add tutor message server action"
```

---

## Task 5: TutorPanel client component (TDD)

**Files:**
- Create: `components/TutorPanel.tsx`, `components/TutorPanel.test.tsx`

**Interfaces:**
- Produces:
  - `interface TutorMessage { id: number; role: string; content: string }`
  - `interface TutorPanelProps { slug: string; messages: TutorMessage[]; action: (formData: FormData) => void | Promise<void> }`
  - `TutorPanel(props): JSX.Element` — a `"use client"` component (no db/server imports; receives the action as a prop). Renders the conversation (user vs assistant aligned/colored), an empty-state hint when there are no messages, and a form (`action={action}`) with a hidden `slug` input, a controlled text input `name="body"`, and a Send button (disabled while the body is empty). A "Teach it back" button (type="button") fills the input with a preset prompt so the learner can send it.

- [ ] **Step 1: Write the failing component test**

`components/TutorPanel.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TutorPanel } from "./TutorPanel";

const noop = async () => {};

describe("TutorPanel", () => {
  it("renders existing messages", () => {
    render(
      <TutorPanel
        slug="sliding-window"
        messages={[
          { id: 1, role: "user", content: "what triggers sliding window?" },
          { id: 2, role: "assistant", content: "contiguous subarray problems" },
        ]}
        action={noop}
      />
    );
    expect(screen.getByText("what triggers sliding window?")).toBeInTheDocument();
    expect(screen.getByText("contiguous subarray problems")).toBeInTheDocument();
  });

  it("shows an empty-state hint with no messages and disables Send until typed", () => {
    render(<TutorPanel slug="sliding-window" messages={[]} action={noop} />);
    expect(screen.getByText(/ask the tutor/i)).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/ask about/i), {
      target: { value: "explain the window invariant" },
    });
    expect(send).toBeEnabled();
  });

  it("Teach it back fills the input", () => {
    const { container } = render(
      <TutorPanel slug="sliding-window" messages={[]} action={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Teach it back" }));
    const input = container.querySelector(
      'input[name="body"]'
    ) as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);
  });

  it("carries the slug in a hidden field", () => {
    const { container } = render(
      <TutorPanel slug="sliding-window" messages={[]} action={noop} />
    );
    const hidden = container.querySelector(
      'input[type="hidden"][name="slug"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("sliding-window");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/TutorPanel.test.tsx`
Expected: FAIL — cannot find `./TutorPanel`.

- [ ] **Step 3: Implement the component**

`components/TutorPanel.tsx`:
```tsx
"use client";

import { useState } from "react";

export interface TutorMessage {
  id: number;
  role: string;
  content: string;
}

export interface TutorPanelProps {
  slug: string;
  messages: TutorMessage[];
  action: (formData: FormData) => void | Promise<void>;
}

const TEACH_IT_BACK =
  "Quiz me: ask me to explain this pattern as if in an interview, then tell me what I got right and what I missed.";

export function TutorPanel(props: TutorPanelProps) {
  const { slug, messages, action } = props;
  const [body, setBody] = useState("");

  return (
    <section style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <h2 style={{ fontSize: 16 }}>Tutor</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Ask the tutor about this pattern, or click Teach it back.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 11px",
              borderRadius: 10,
              whiteSpace: "pre-wrap",
              background:
                m.role === "user"
                  ? "rgba(99,102,241,0.18)"
                  : "var(--panel)",
              border: "1px solid var(--border)",
            }}
          >
            {m.content}
          </div>
        ))}
      </div>

      <form action={action} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="hidden" name="slug" value={slug} />
        <input
          type="text"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask about this pattern…"
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--fg)",
          }}
        />
        <button
          type="button"
          onClick={() => setBody(TEACH_IT_BACK)}
          style={{
            padding: "7px 11px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--fg)",
            cursor: "pointer",
          }}
        >
          Teach it back
        </button>
        <button
          type="submit"
          disabled={body.trim() === ""}
          style={{
            padding: "7px 14px",
            borderRadius: 6,
            border: "none",
            background: body.trim() === "" ? "var(--border)" : "var(--accent)",
            color: "white",
            fontWeight: 600,
            cursor: body.trim() === "" ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/TutorPanel.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add components/TutorPanel.tsx components/TutorPanel.test.tsx
git commit -m "feat: add TutorPanel client component"
```

---

## Task 6: Wire the tutor into the pattern detail page

**Files:**
- Modify: `app/(shell)/patterns/[slug]/page.tsx`

**Interfaces:**
- Consumes: `findTutorSession` + `listTutorMessages` (Task 2), `TutorPanel` (Task 5), `sendTutorMessageAction` (Task 4).
- Produces: a Tutor section at the bottom of the pattern detail page showing the persisted conversation and the input.

- [ ] **Step 1: Read the current file to find the imports and the closing `</main>`**

Run: `sed -n '1,40p' "app/(shell)/patterns/[slug]/page.tsx"` and `sed -n '40,200p' "app/(shell)/patterns/[slug]/page.tsx"`
Identify the import block and the final `</main>` (after the "Problems in this pattern" section).

- [ ] **Step 2: Add the imports**

Add alongside the existing imports in `app/(shell)/patterns/[slug]/page.tsx`:
```tsx
import { findTutorSession, listTutorMessages } from "@/lib/db/tutor";
import { TutorPanel } from "@/components/TutorPanel";
import { sendTutorMessageAction } from "@/lib/tutor/actions";
```

- [ ] **Step 3: Load the conversation**

After the existing line that loads the pattern's mapped problems (`const problems = listProblemsForPattern(db, pattern.id);`), add:
```tsx
  const tutorSessionId = findTutorSession(db, "pattern", pattern.id);
  const tutorMessages = tutorSessionId
    ? listTutorMessages(db, tutorSessionId)
    : [];
```

- [ ] **Step 4: Render the TutorPanel before the closing `</main>`**

Immediately before the closing `</main>` tag, add:
```tsx
      <TutorPanel
        slug={slug}
        messages={tutorMessages}
        action={sendTutorMessageAction}
      />
```

- [ ] **Step 5: Type-check**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Verify in the browser (no-key path)**

Run: `npm run migrate >/dev/null 2>&1; npm run seed >/dev/null 2>&1`
Ensure NO API key is set (fresh seed leaves `app_state` empty). Run `npm run dev`, load `http://localhost:3000/patterns/sliding-window`.
Expected: a "Tutor" section with the empty-state hint, a "Teach it back" button, an input, and a Send button. Type "what triggers sliding window?" and Send. The page reloads showing your message and an assistant reply: "No Anthropic API key is set. Add one in Settings to chat with the tutor." Verify both messages persisted:
`npx tsx -e "import('better-sqlite3').then(({default:D})=>{const db=new D('data/dsa.sqlite');console.log(db.prepare('SELECT role, content FROM tutor_messages ORDER BY id').all())})"`
Expected: two rows — the user message and the no-key assistant message. Stop the dev server.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add "app/(shell)/patterns/[slug]/page.tsx"
git commit -m "feat: add the AI tutor panel to the pattern page"
```

---

## Definition of Done (Phase 4)

- Each pattern page has a Tutor section: a persisted conversation, a text input, a Send button, and a "Teach it back" starter.
- Sending a message persists it, calls `claude-opus-4-8` (grounded in the pattern's study content) when an API key is set, and persists the reply; the conversation survives reloads.
- With no API key set, the tutor replies with a clear "set your key in Settings" message (no crash).
- A failed API call degrades to a friendly error message rather than an unhandled exception.
- The Anthropic key is read only server-side; `@anthropic-ai/sdk` never enters a client component.
- `npm test` passes (Phase 0–3 tests + new tutor data / prompt / component tests); `tsc --noEmit` is clean.
- Deferred to later: streaming responses, problem-scoped tutor, and auto-feeding "teach it back" into the SRS rating.

## Self-Review Notes

- **Spec coverage:** typed tutor chat per pattern (§7) ✓ Tasks 4–6; grounded in the pattern's Markdown content (§7) ✓ Tasks 3–4; "teach it back" mode (§7) ✓ Task 5 (starter) — note the §7 idea of a teach-it-back session *feeding the SRS rating* is intentionally deferred; backed by the Anthropic API via a server-side route with the key never reaching the browser (§3, §7) ✓ Tasks 1, 4; sessions and messages persisted (§7) ✓ Tasks 2, 6. Voice and the right-panel two-column layout from the mock are not implemented — the tutor is a section on the pattern page (functionally equivalent; full panel layout is a later polish).
- **Placeholder scan:** none — every step has runnable code/commands. The "(If that exact version is unavailable…)" note in Task 1 is an install-resilience instruction, not a code placeholder.
- **Type consistency:** `TutorTurn`, `askClaude`, `TutorScope`, `TutorMessageRow`, `findTutorSession`, `getOrCreateTutorSession`, `listTutorMessages`, `addTutorMessage`, `buildTutorSystem`, `sendTutorMessageAction`, `TutorMessage`/`TutorPanelProps`/`TutorPanel` are used consistently across tasks. The page passes `action={sendTutorMessageAction}` and `slug`/`messages` matching `TutorPanelProps`; the action and the form agree on the `slug` and `body` field names.
- **Boundary:** `@anthropic-ai/sdk` is imported only in `lib/tutor/anthropic.ts` (used by the server action); `TutorPanel` imports only `react` and receives the action as a prop — the server-only DB/SDK boundary holds.
