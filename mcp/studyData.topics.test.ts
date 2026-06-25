import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPattern, listNotes, listProblemsTool } from "@/mcp/studyData";

let db: Database.Database;
let contentDir: string;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE patterns (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, status TEXT DEFAULT 'not_started', ordering INTEGER DEFAULT 0);
    CREATE TABLE problems (id INTEGER PRIMARY KEY, title TEXT, lc_url TEXT, difficulty TEXT, status TEXT DEFAULT 'not_started');
    CREATE TABLE problem_patterns (problem_id INTEGER, pattern_id INTEGER, PRIMARY KEY (problem_id, pattern_id));
    CREATE TABLE attempts (id INTEGER PRIMARY KEY, problem_id INTEGER, date TEXT, outcome TEXT, rating TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, pattern_id INTEGER, section_key TEXT, body TEXT);
  `);
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (1,'Sliding Window','sliding-window','learning',1)").run();
  db.prepare("INSERT INTO patterns (id,name,slug,status,ordering) VALUES (2,'Binary Search','binary-search','not_started',2)").run();
  db.prepare("INSERT INTO problems (id,title,difficulty,status) VALUES (1,'Longest Substring','Medium','solved')").run();
  db.prepare("INSERT INTO problem_patterns (problem_id,pattern_id) VALUES (1,1)").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (1,1,'overview','two pointers, grow and shrink')").run();
  db.prepare("INSERT INTO notes (id,pattern_id,section_key,body) VALUES (2,2,'overview','halve the search space')").run();

  contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsa-content-"));
  fs.writeFileSync(path.join(contentDir, "sliding-window.md"), "# Sliding Window\nGrow and shrink a window.");
});
afterEach(() => fs.rmSync(contentDir, { recursive: true, force: true }));

describe("getPattern", () => {
  it("returns material, notes, and mapped problems for a slug", () => {
    const d = getPattern(db, "sliding-window", contentDir);
    expect(d.pattern.name).toBe("Sliding Window");
    expect(d.material).toContain("Grow and shrink");
    expect(d.notes).toHaveLength(1);
    expect(d.problems.map((p) => p.title)).toEqual(["Longest Substring"]);
  });
  it("resolves by display name too", () => {
    expect(getPattern(db, "Sliding Window", contentDir).pattern.slug).toBe("sliding-window");
  });
  it("returns null material when no file exists", () => {
    expect(getPattern(db, "binary-search", contentDir).material).toBeNull();
  });
  it("throws a helpful error for an unknown pattern", () => {
    expect(() => getPattern(db, "nope", contentDir)).toThrow(/list_patterns/);
  });
});

describe("listNotes", () => {
  it("returns all notes when no pattern is given", () => {
    expect(listNotes(db)).toHaveLength(2);
  });
  it("filters to one pattern", () => {
    const notes = listNotes(db, "sliding-window");
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("grow and shrink");
  });
});

describe("listProblemsTool", () => {
  it("filters by status", () => {
    const rows = listProblemsTool(db, { status: "solved" });
    expect(rows.map((r) => r.title)).toEqual(["Longest Substring"]);
  });
});
