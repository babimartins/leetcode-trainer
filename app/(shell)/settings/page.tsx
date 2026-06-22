import path from "node:path";
import { getDb } from "@/lib/db/connection";
import { getAppState } from "@/lib/db/appState";
import { saveApiKey } from "@/lib/settings/actions";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const saved = getAppState(getDb(), "anthropic_api_key");
  const hasKey = Boolean(saved && saved.length > 0);
  const dbPath = path.join(process.cwd(), "data", "dsa.sqlite");

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>Settings</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Anthropic API key</h2>
        <p style={{ color: "var(--muted)" }}>
          Status: {hasKey ? "saved" : "not set"}. Used server-side for the AI
          tutor; never sent to the browser.
        </p>
        <form action={saveApiKey} style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            name="apiKey"
            placeholder="sk-ant-..."
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Data</h2>
        <p style={{ color: "var(--muted)" }}>Database file: {dbPath}</p>
      </section>
    </main>
  );
}
