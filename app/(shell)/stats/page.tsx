import { getDb } from "@/lib/db/connection";
import { todayIso } from "@/lib/srs/dates";
import {
  solvedCount,
  patternsProgress,
  dueCount,
  currentStreak,
} from "@/lib/db/stats";
import {
  solvedByDifficulty,
  totalAttempts,
  patternMastery,
} from "@/lib/db/statsPage";

export const dynamic = "force-dynamic";

const card = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 14px",
} as const;

export default function StatsPage() {
  const db = getDb();
  const today = todayIso();
  const solved = solvedCount(db);
  const attempts = totalAttempts(db);
  const due = dueCount(db, today);
  const streak = currentStreak(db, today);
  const patterns = patternsProgress(db);
  const byDifficulty = solvedByDifficulty(db);
  const mastery = patternMastery(db);

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Stats</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{solved}</div>
          <div style={{ color: "var(--muted)" }}>problems solved</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{attempts}</div>
          <div style={{ color: "var(--muted)" }}>attempts logged</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{due}</div>
          <div style={{ color: "var(--muted)" }}>due for review</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{streak}</div>
          <div style={{ color: "var(--muted)" }}>day streak</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {patterns.started}/{patterns.total}
          </div>
          <div style={{ color: "var(--muted)" }}>patterns started</div>
        </div>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Solved by difficulty</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 22, color: "var(--muted)" }}>
        {byDifficulty.length === 0 ? (
          <span>No solved problems yet.</span>
        ) : (
          byDifficulty.map((d) => (
            <span key={d.difficulty}>
              {d.difficulty}: <span style={{ color: "var(--fg)", fontWeight: 600 }}>{d.solved}</span>
            </span>
          ))
        )}
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Pattern mastery</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", padding: "0 10px" }}>
          <span>Pattern</span><span>Status</span><span>Ease</span><span>Interval</span>
        </div>
        {mastery.map((m) => (
          <a
            key={m.slug}
            href={`/patterns/${m.slug}`}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", alignItems: "center", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
          >
            <span style={{ fontWeight: 600 }}>{m.name}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{m.status.replace("_", " ")}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{m.ease ?? "—"}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {m.interval_days != null ? `${m.interval_days}d` : "—"}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
