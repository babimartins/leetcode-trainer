CREATE TABLE patterns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_path TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  ordering INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE problems (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  lc_slug TEXT,
  lc_url TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE problem_sources (
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, source_id)
);

CREATE TABLE problem_patterns (
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, pattern_id)
);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  outcome TEXT NOT NULL CHECK (outcome IN ('solved','partial','failed')),
  rating TEXT CHECK (rating IN ('hard','ok','easy')),
  minutes INTEGER,
  used_hint INTEGER NOT NULL DEFAULT 0,
  reflection TEXT
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('problem','pattern')),
  item_id INTEGER NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  last_reviewed TEXT,
  UNIQUE (item_type, item_id)
);

CREATE TABLE tutor_sessions (
  id INTEGER PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('pattern','problem')),
  scope_id INTEGER NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tutor_messages (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attempts_problem ON attempts(problem_id);
CREATE INDEX idx_reviews_due ON reviews(due_date);
CREATE INDEX idx_notes_pattern ON notes(pattern_id);
