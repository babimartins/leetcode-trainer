import Link from "next/link";
import { getDb } from "@/lib/db/connection";
import { listPatterns } from "@/lib/db/patterns";

export const dynamic = "force-dynamic";

export default function PatternsPage() {
  const patterns = listPatterns(getDb());
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Patterns</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {patterns.map((p) => (
          <Link
            key={p.slug}
            href={`/patterns/${p.slug}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.status.replace("_", " ")}</span>
          </Link>
        ))}
        {patterns.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No patterns yet. Run `npm run seed`.</p>
        )}
      </div>
    </main>
  );
}
