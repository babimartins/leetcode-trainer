import { getDb } from "@/lib/db/connection";
import { listProblems, type ProblemFilters } from "@/lib/db/problemsList";
import { listPatterns } from "@/lib/db/patterns";
import { listSources } from "@/lib/db/sources";
import { LogAttemptForm } from "@/components/LogAttemptForm";
import { logAttemptAction } from "@/lib/attempts/actions";

export const dynamic = "force-dynamic";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const STATUSES = [
  { value: "not_started", label: "not started" },
  { value: "solving", label: "solving" },
  { value: "solved", label: "solved" },
];

function val(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

const selectStyle = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--fg)",
} as const;

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters: ProblemFilters = {
    q: val(sp, "q"),
    difficulty: val(sp, "difficulty"),
    status: val(sp, "status"),
    patternSlug: val(sp, "pattern"),
    source: val(sp, "source"),
  };

  const db = getDb();
  const problems = listProblems(db, filters);
  const patterns = listPatterns(db);
  const sources = listSources(db);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Problems</h1>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="Search problems…"
          style={{ ...selectStyle, flex: 1, minWidth: 160 }}
        />
        <select name="pattern" defaultValue={filters.patternSlug} style={selectStyle}>
          <option value="">Pattern: All</option>
          {patterns.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <select name="difficulty" defaultValue={filters.difficulty} style={selectStyle}>
          <option value="">Difficulty: All</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} style={selectStyle}>
          <option value="">Status: All</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select name="source" defaultValue={filters.source} style={selectStyle}>
          <option value="">List: All</option>
          {sources.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button type="submit" style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}>
          Filter
        </button>
        <a href="/problems" style={{ ...selectStyle, color: "var(--muted)" }}>Clear</a>
      </form>

      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
        {problems.length} problem{problems.length === 1 ? "" : "s"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {problems.map((p) => (
          <div key={p.id}>
            <LogAttemptForm
              problemId={p.id}
              problemTitle={p.title}
              lcUrl={p.lc_url}
              difficulty={p.difficulty}
              revalidate="/problems"
              action={logAttemptAction}
            />
            <div style={{ display: "flex", gap: 12, padding: "2px 12px 0", fontSize: 12, color: "var(--muted)" }}>
              <span>{p.patterns ?? "—"}</span>
              <span>· {p.status.replace("_", " ")}</span>
              {p.last_outcome && <span>· last: {p.last_outcome}</span>}
            </div>
          </div>
        ))}
        {problems.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No problems match these filters.</p>
        )}
      </div>
    </main>
  );
}
