# DSA Trainer — Study Connector (MCP)

A local, **read-only** Model Context Protocol server that lets the **Claude
desktop app** read your live study database and answer questions about your
patterns, problems, weak areas, notes, attempts, and stats. It runs locally over
stdio, uses your Claude subscription (no API credits), and cannot modify anything.

## What Claude can do

Tools: `study_stats`, `weakest_patterns`, `due_for_review`, `recent_activity`,
`list_patterns`, `get_pattern`, `list_notes`, `list_problems`.
Prompt: `study_session` (starts a grounded Socratic tutoring session).

## Setup (one time)

1. Make sure the study database exists: from the repo root, run
   `npm run migrate` (and `npm run seed` for sample data) if you have not already.
2. Install the **Claude desktop app** and sign in.
3. Open Claude's config file:
   `~/Library/Application Support/Claude/claude_desktop_config.json`
   (create it if it does not exist).
4. Add the `dsa-trainer` server:

   ```json
   {
     "mcpServers": {
       "dsa-trainer": {
         "command": "npx",
         "args": ["tsx", "mcp/server.ts"],
         "cwd": "/Users/barbarad/Documents/LeetCode/dsa-trainer",
         "env": {
           "DSA_DB_PATH": "/Users/barbarad/Documents/LeetCode/dsa-trainer/data/dsa.sqlite"
         }
       }
     }
   }
   ```

5. Quit and reopen the Claude desktop app. "DSA Trainer" appears as a connector.

## Using it

- Pick the **`study_session`** prompt to start a tutoring session, or just ask
  questions like "what am I weakest on?", "what's unsolved in the sliding-window
  list?", or "explain binary search using my notes."
- It reads the database live, so anything you log in the app shows up on your next
  question. The DSA Trainer app does not need to be running.

## Troubleshooting

- **"Study database not found"** — run `npm run migrate` in the repo, and check the
  `DSA_DB_PATH` in the config points at `data/dsa.sqlite`.
- **Connector doesn't appear** — confirm the `cwd` is the repo root (so `tsx`
  finds `tsconfig.json`) and fully quit/reopen the Claude desktop app.
- It is read-only by design: Claude cannot change your data through it.
