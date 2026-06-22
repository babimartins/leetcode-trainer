// Server/CLI-only module. Do NOT import from client components — better-sqlite3
// is a native module (kept out of the client bundle via serverExternalPackages
// in next.config.ts). Used by server code and the migrate/seed scripts.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "dsa.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  instance = db;
  return instance;
}
