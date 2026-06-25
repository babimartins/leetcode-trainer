import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAll } from "@/mcp/register";

let db: Database.Database;
let server: McpServer;
let client: Client;

beforeEach(async () => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT);
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, item_type TEXT, item_id INTEGER, ease REAL, interval_days INTEGER, due_date TEXT, last_reviewed TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,ordering) VALUES (1,'Sliding Window','sliding-window',1)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Two Sum','Easy','solved')").run();
  db.prepare("INSERT INTO attempts (id,problem_id,date,outcome) VALUES (1,1,'2026-06-25 09:00:00','solved')").run();

  server = new McpServer({ name: "dsa-trainer-test", version: "0" });
  registerAll(server, { openDb: () => db, today: () => "2026-06-25" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await server.close();
  db.close();
});

it("registers exactly the eight tools", async () => {
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    "due_for_review",
    "get_pattern",
    "list_notes",
    "list_patterns",
    "list_problems",
    "recent_activity",
    "study_stats",
    "weakest_patterns",
  ]);
});

it("registers the study_session prompt", async () => {
  const { prompts } = await client.listPrompts();
  expect(prompts.map((p) => p.name)).toContain("study_session");
});

it("study_stats returns JSON data", async () => {
  const res = await client.callTool({ name: "study_stats", arguments: {} });
  expect(res.isError).toBeFalsy();
  const text = (res.content as Array<{ text: string }>)[0].text;
  expect(JSON.parse(text)).toHaveProperty("solved", 1);
});

it("get_pattern on an unknown pattern returns an error result", async () => {
  const res = await client.callTool({ name: "get_pattern", arguments: { pattern: "nope" } });
  expect(res.isError).toBe(true);
  expect((res.content as Array<{ text: string }>)[0].text).toMatch(/list_patterns/);
});
