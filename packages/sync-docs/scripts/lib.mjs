// Shared helpers for the docs-sync scripts.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const DOCS_DIR = path.join(PROJECT_ROOT, ".claude", "docs");
export const STATE_FILE = path.join(
  PROJECT_ROOT,
  ".claude",
  ".docs-sync-state.json"
);

// Load .env / .env.local into process.env without extra deps.
// (Node >= 20.12 ships process.loadEnvFile.)
export function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const file = path.join(PROJECT_ROOT, name);
    try {
      if (fs.existsSync(file)) process.loadEnvFile(file);
    } catch {
      /* malformed env file - ignore, the caller validates what it needs */
    }
  }
}

// Write `content` to DOCS_DIR/<name> only when it actually changed.
// Returns "created" | "updated" | "unchanged".
export function writeIfChanged(name, content) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const target = path.join(DOCS_DIR, name);
  let previous = null;
  try {
    previous = fs.readFileSync(target, "utf8");
  } catch {
    /* file does not exist yet */
  }
  if (previous === content) return "unchanged";
  fs.writeFileSync(target, content, "utf8");
  return previous === null ? "created" : "updated";
}

export function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
