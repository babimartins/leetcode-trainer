import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "./migrate";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeMigration(name: string, sql: string) {
  fs.writeFileSync(path.join(dir, name), sql);
}

describe("runMigrations", () => {
  it("applies pending migrations in filename order and records them", () => {
    writeMigration("0001_a.sql", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    writeMigration("0002_b.sql", "CREATE TABLE b (id INTEGER PRIMARY KEY);");
    const db = new Database(":memory:");

    const applied = runMigrations(db, dir);

    expect(applied).toEqual(["0001_a.sql", "0002_b.sql"]);
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).toContain("a");
    expect(tables).toContain("b");
    expect(tables).toContain("_migrations");
  });

  it("is idempotent — a second run applies nothing", () => {
    writeMigration("0001_a.sql", "CREATE TABLE a (id INTEGER PRIMARY KEY);");
    const db = new Database(":memory:");
    runMigrations(db, dir);

    const secondRun = runMigrations(db, dir);

    expect(secondRun).toEqual([]);
  });

  it("rolls back a failing migration atomically", () => {
    writeMigration("0001_ok.sql", "CREATE TABLE ok (id INTEGER PRIMARY KEY);");
    writeMigration("0002_bad.sql", "CREATE TABLE ok (id INTEGER);"); // duplicate table -> error
    const db = new Database(":memory:");

    expect(() => runMigrations(db, dir)).toThrow();
    const recorded = (
      db.prepare("SELECT name FROM _migrations ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(recorded).toEqual(["0001_ok.sql"]); // 0002 not recorded
  });
});
