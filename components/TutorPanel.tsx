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
