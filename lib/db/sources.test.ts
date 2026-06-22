import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { listSources } from "./sources";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.exec("CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);");
  db.prepare("INSERT INTO sources (name) VALUES ('NeetCode 150')").run();
  db.prepare("INSERT INTO sources (name) VALUES ('Blind 75')").run();
});

describe("listSources", () => {
  it("returns sources ordered by name", () => {
    expect(listSources(db).map((s) => s.name)).toEqual(["Blind 75", "NeetCode 150"]);
  });
});
