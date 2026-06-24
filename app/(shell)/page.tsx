import Link from "next/link";
import { getDb } from "@/lib/db/connection";
import { getDueItems } from "@/lib/db/reviews";
import { todayIso, addDays } from "@/lib/srs/dates";
import {
  dueCount,
  solvedCount,
  patternsProgress,
  currentStreak,
  lastAttemptedProblem,
} from "@/lib/db/stats";
import { attemptCountsByDay } from "@/lib/db/activity";
import { buildHeatmap } from "@/lib/heatmap/grid";
import { Heatmap } from "@/components/Heatmap";
import { weakestPattern } from "@/lib/db/weakest";

export const dynamic = "force-dynamic";

const card = {
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 14px",
} as const;

export default function TodayPage() {
  const db = getDb();
  const today = todayIso();
  const due = dueCount(db, today);
  const solved = solvedCount(db);
  const patterns = patternsProgress(db);
  const streak = currentStreak(db, today);
  const resume = lastAttemptedProblem(db);
  const dueItems = getDueItems(db, today).slice(0, 5);
  const heatmapCells = buildHeatmap(
    attemptCountsByDay(db, addDays(today, -90)),
    today,
    13
  );
  const weakest = weakestPattern(db);

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Today</h1>
        <span style={{ color: "var(--muted)" }}>
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </span>
      </div>
      <div style={{ color: "var(--muted)", marginBottom: 18 }}>{today}</div>

      {resume && (
        <div style={{ border: "1px solid var(--accent)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>
            Resume where you left off
          </div>
          {resume.lc_url ? (
            <a href={resume.lc_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
              {resume.title} ↗
            </a>
          ) : (
            <span style={{ fontWeight: 700 }}>{resume.title}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <Link href="/review" style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{due}</div>
          <div style={{ color: "var(--muted)" }}>due for review</div>
        </Link>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{solved}</div>
          <div style={{ color: "var(--muted)" }}>problems solved</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {patterns.started}/{patterns.total}
          </div>
          <div style={{ color: "var(--muted)" }}>patterns started</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Link
          href={weakest ? `/patterns/${weakest.slug}` : "/patterns"}
          style={{ ...card, display: "inline-block", flex: "none" }}
        >
          Study a pattern →
          {weakest && (
            <span style={{ color: "var(--muted)", fontWeight: 400 }}> {weakest.name}</span>
          )}
        </Link>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Due today</div>
      {dueItems.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nothing due — you're all caught up.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dueItems.map((item) => (
            <Link
              key={`${item.item_type}:${item.item_id}`}
              href="/review"
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
            >
              <span>{item.title}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{item.item_type}</span>
            </Link>
          ))}
        </div>
      )}
      <div style={{ marginTop: 24, fontWeight: 700, marginBottom: 8 }}>Activity</div>
      <Heatmap cells={heatmapCells} />
    </main>
  );
}
