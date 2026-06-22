import { getDb } from "@/lib/db/connection";

const db = getDb();

const insertPattern = db.prepare(
  `INSERT OR IGNORE INTO patterns (name, slug, status, ordering)
   VALUES (?, ?, 'not_started', ?)`
);
const patterns: Array<[string, string, number]> = [
  ["Sliding Window", "sliding-window", 1],
  ["Binary Search", "binary-search", 2],
  ["Graphs · BFS/DFS", "graphs-bfs-dfs", 3],
];
patterns.forEach((p) => insertPattern.run(...p));

const insertSource = db.prepare(
  "INSERT OR IGNORE INTO sources (name) VALUES (?)"
);
insertSource.run("Blind 75");

const insertProblem = db.prepare(
  `INSERT OR IGNORE INTO problems (title, lc_slug, lc_url, difficulty)
   VALUES (?, ?, ?, ?)`
);
const problems: Array<[string, string, string, string]> = [
  [
    "Longest Substring Without Repeating Characters",
    "longest-substring-without-repeating-characters",
    "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    "Medium",
  ],
  [
    "Koko Eating Bananas",
    "koko-eating-bananas",
    "https://leetcode.com/problems/koko-eating-bananas/",
    "Medium",
  ],
  [
    "Number of Islands",
    "number-of-islands",
    "https://leetcode.com/problems/number-of-islands/",
    "Medium",
  ],
];
problems.forEach((p) => insertProblem.run(...p));

// Map each sample problem to its pattern (by slug) so Phase 1/2 fixtures are realistic.
const linkPattern = db.prepare(
  `INSERT OR IGNORE INTO problem_patterns (problem_id, pattern_id)
   VALUES ((SELECT id FROM problems WHERE lc_slug = ?),
           (SELECT id FROM patterns WHERE slug = ?))`
);
const problemPatterns: Array<[string, string]> = [
  ["longest-substring-without-repeating-characters", "sliding-window"],
  ["koko-eating-bananas", "binary-search"],
  ["number-of-islands", "graphs-bfs-dfs"],
];
problemPatterns.forEach((m) => linkPattern.run(...m));

// Put every sample problem on the "Blind 75" list.
const linkSource = db.prepare(
  `INSERT OR IGNORE INTO problem_sources (problem_id, source_id)
   VALUES ((SELECT id FROM problems WHERE lc_slug = ?),
           (SELECT id FROM sources WHERE name = ?))`
);
problems.forEach(([, slug]) => linkSource.run(slug, "Blind 75"));

console.log(
  `Seeded: ${patterns.length} patterns, ${problems.length} problems, 1 source, ` +
    `${problemPatterns.length} pattern links, ${problems.length} source links.`
);
