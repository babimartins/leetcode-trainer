import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openReadOnlyDb } from "@/mcp/db";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-mcp-"));
  dbPath = path.join(dir, "dsa.sqlite");
  const w = new Database(dbPath);
  w.exec("CREATE TABLE t (x INTEGER); INSERT INTO t (x) VALUES (42);");
  w.close();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("openReadOnlyDb", () => {
  it("opens an existing db read-only and reads data", () => {
    const ro = openReadOnlyDb(dbPath);
    expect((ro.prepare("SELECT x FROM t").get() as { x: number }).x).toBe(42);
    ro.close();
  });

  it("rejects writes", () => {
    const ro = openReadOnlyDb(dbPath);
    expect(() => ro.prepare("INSERT INTO t (x) VALUES (1)").run()).toThrow(/readonly/i);
    ro.close();
  });

  it("throws a friendly error when the db file is missing", () => {
    expect(() => openReadOnlyDb(path.join(dir, "nope.sqlite"))).toThrow(/npm run migrate/);
  });
});
