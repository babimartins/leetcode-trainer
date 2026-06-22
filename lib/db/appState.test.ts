import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getAppState, setAppState } from "./appState";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);");
});

describe("app_state helpers", () => {
  it("returns null for a missing key", () => {
    expect(getAppState(db, "nope")).toBeNull();
  });

  it("sets then gets a value", () => {
    setAppState(db, "anthropic_api_key", "sk-test-123");
    expect(getAppState(db, "anthropic_api_key")).toBe("sk-test-123");
  });

  it("upserts — setting an existing key overwrites it", () => {
    setAppState(db, "k", "v1");
    setAppState(db, "k", "v2");
    expect(getAppState(db, "k")).toBe("v2");
  });
});
