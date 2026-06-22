import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/connection";
import { getPatternBySlug } from "@/lib/db/patterns";
import { listNotesForPattern, type NoteRow } from "@/lib/db/notes";
import { listProblemsForPattern } from "@/lib/db/problemsForPattern";
import { loadPatternContent } from "@/lib/content/loadPattern";
import { splitSections } from "@/lib/content/sections";
import { MarkdownView } from "@/components/MarkdownView";
import { addNoteAction, deleteNoteAction } from "@/lib/notes/actions";
import { LogAttemptForm } from "@/components/LogAttemptForm";
import { logAttemptAction } from "@/lib/attempts/actions";

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
  const problems = listProblemsForPattern(db, pattern.id);
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
      <section style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Problems in this pattern</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {problems.map((p) => (
            <LogAttemptForm
              key={p.id}
              problemId={p.id}
              problemTitle={p.title}
              lcUrl={p.lc_url}
              difficulty={p.difficulty}
              revalidate={`/patterns/${slug}`}
              action={logAttemptAction}
            />
          ))}
          {problems.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No problems mapped yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
