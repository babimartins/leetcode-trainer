import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type Database from "better-sqlite3";
import { openReadOnlyDb } from "@/mcp/db";
import { registerAll } from "@/mcp/register";
import { todayIso } from "@/lib/srs/dates";

// Lazily open one read-only connection, reused across calls. With WAL, a
// read-only connection sees the latest committed state on each query, so the
// answers stay live as the app writes. Re-tries if the file did not exist yet.
let cached: Database.Database | null = null;
function db(): Database.Database {
  if (!cached) cached = openReadOnlyDb();
  return cached;
}

const server = new McpServer({ name: "dsa-trainer", version: "0.1.0" });
registerAll(server, { openDb: db, today: () => todayIso() });

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the JSON-RPC channel.
  console.error("DSA Trainer MCP server running (stdio).");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
