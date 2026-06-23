import { getDb } from "@/lib/db/connection";
import { getDueItems } from "@/lib/db/reviews";
import { todayIso } from "@/lib/srs/dates";
import { recordReviewAction } from "@/lib/reviews/actions";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const due = getDueItems(getDb(), todayIso());

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Review queue</h1>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 16px" }}>
        {due.length} item{due.length === 1 ? "" : "s"} due
      </p>

      {due.length === 0 && (
        <p style={{ color: "var(--muted)" }}>All caught up — nothing due today.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {due.map((item) => (
          <div
            key={`${item.item_type}:${item.item_id}`}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              {item.item_type === "problem" && item.lc_url ? (
                <a href={item.lc_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {item.title} ↗
                </a>
              ) : item.item_type === "pattern" && item.slug ? (
                <a href={`/patterns/${item.slug}`} style={{ fontWeight: 600 }}>
                  {item.title}
                </a>
              ) : (
                <span style={{ fontWeight: 600 }}>{item.title}</span>
              )}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {item.item_type}
              </span>
            </div>
            <form action={recordReviewAction} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="hidden" name="itemType" value={item.item_type} />
              <input type="hidden" name="itemId" value={item.item_id} />
              <input type="hidden" name="revalidate" value="/review" />
              {(["hard", "ok", "easy"] as const).map((r) => (
                <button
                  key={r}
                  type="submit"
                  name="rating"
                  value={r}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--fg)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {r}
                </button>
              ))}
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
