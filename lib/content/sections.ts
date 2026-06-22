export interface Section {
  key: string;
  title: string;
  body: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { title: string; bodyLines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({
        key: slugify(current.title),
        title: current.title,
        body: current.bodyLines.join("\n").trim(),
      });
      current = null;
    }
  };

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = { title: heading[1], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  const pre = preamble.join("\n").trim();
  if (pre) {
    sections.unshift({ key: "overview", title: "Overview", body: pre });
  }
  return sections;
}
