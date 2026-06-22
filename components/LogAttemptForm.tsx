"use client";

import { useState } from "react";

export interface LogAttemptFormProps {
  problemId: number;
  problemTitle: string;
  lcUrl: string | null;
  difficulty?: string;
  revalidate: string;
  action: (formData: FormData) => void | Promise<void>;
}

const OUTCOMES: Array<{ value: string; label: string }> = [
  { value: "solved", label: "Solved" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
];
const RATINGS: Array<{ value: string; label: string }> = [
  { value: "hard", label: "Hard" },
  { value: "ok", label: "OK" },
  { value: "easy", label: "Easy" },
];

const chip = (active: boolean): React.CSSProperties => ({
  flex: 1,
  textAlign: "center",
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
  border: active
    ? "2px solid var(--accent)"
    : "1px solid var(--border)",
  background: active ? "rgba(99,102,241,0.12)" : "transparent",
  color: "var(--fg)",
  fontWeight: active ? 600 : 400,
});

export function LogAttemptForm(props: LogAttemptFormProps) {
  const { problemId, problemTitle, lcUrl, difficulty, revalidate, action } =
    props;
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [rating, setRating] = useState("");

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        {lcUrl ? (
          <a href={lcUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
            {problemTitle} ↗
          </a>
        ) : (
          <span style={{ fontWeight: 600 }}>{problemTitle}</span>
        )}
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {difficulty && (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{difficulty}</span>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
              cursor: "pointer",
            }}
          >
            {open ? "Close" : "Log"}
          </button>
        </span>
      </div>

      {open && (
        <form action={action} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="problemId" value={problemId} />
          <input type="hidden" name="revalidate" value={revalidate} />
          <input type="hidden" name="outcome" value={outcome} />
          <input type="hidden" name="rating" value={rating} />

          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
              Outcome
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  style={chip(outcome === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
              How did it feel?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRating(r.value)}
                  style={chip(rating === r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Time (min){" "}
              <input
                type="number"
                name="minutes"
                min={0}
                style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
              />
            </label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              <input type="checkbox" name="usedHint" /> used a hint
            </label>
          </div>

          <input
            type="text"
            name="reflection"
            placeholder="Reflection (optional)"
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={outcome === ""}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: outcome === "" ? "var(--border)" : "var(--accent)",
                color: "white",
                fontWeight: 600,
                cursor: outcome === "" ? "not-allowed" : "pointer",
              }}
            >
              Log attempt
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
