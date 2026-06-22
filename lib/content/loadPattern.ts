import fs from "node:fs";
import path from "node:path";

export function loadPatternContent(
  slug: string,
  baseDir: string = path.join(process.cwd(), "content", "patterns")
): string | null {
  const file = path.join(baseDir, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}
