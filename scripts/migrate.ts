import path from "node:path";
import { getDb } from "@/lib/db/connection";
import { runMigrations } from "@/lib/db/migrate";

const dir = path.join(process.cwd(), "lib", "db", "migrations");
const applied = runMigrations(getDb(), dir);
if (applied.length === 0) {
  console.log("No pending migrations.");
} else {
  console.log("Applied:", applied.join(", "));
}
