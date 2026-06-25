import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");
export const DEFAULT_DB_PATH = path.join(REPO_ROOT, "data", "dsa.sqlite");
export const CONTENT_PATTERNS_DIR = path.join(REPO_ROOT, "content", "patterns");

export function openReadOnlyDb(
  dbPath: string = process.env.DSA_DB_PATH || DEFAULT_DB_PATH
): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Study database not found at ${dbPath}. Run \`npm run migrate\` (and \`npm run seed\`) in the DSA Trainer app first.`
    );
  }
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}
