// SessionStart entrypoint: launch the (potentially slow, ~1-2 min for all
// pages) docs sync DETACHED so it never blocks the Claude session, then
// return immediately. The child still self-throttles, so most session starts
// just spawn a process that exits right away.
//
// Foreground/full-report path stays `node scripts/sync-docs.mjs` (used by
// /sync-docs and `npm run sync:docs:force`).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./lib.mjs";

const logPath = path.join(PROJECT_ROOT, ".claude", ".docs-sync.log");
fs.mkdirSync(path.dirname(logPath), { recursive: true });
// Truncate so the log reflects only the latest run.
const log = fs.openSync(logPath, "w");

const child = spawn(
  process.execPath,
  [path.join(PROJECT_ROOT, "scripts", "sync-docs.mjs")],
  { cwd: PROJECT_ROOT, detached: true, stdio: ["ignore", log, log] }
);
child.unref();

console.log(
  `[docs-sync] launched in background (pid ${child.pid}); log: .claude/.docs-sync.log`
);
process.exit(0);
