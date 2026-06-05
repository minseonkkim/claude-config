// Orchestrates the docs sync (API spec + Notion pages).
//
//   node scripts/sync-docs.mjs          throttled - skips if synced recently
//   node scripts/sync-docs.mjs --force  ignores the throttle, syncs now
//
// Always exits 0 so it is safe to wire into a Claude Code SessionStart hook:
// a failed sync must never block a session.
import { loadEnv, readState, writeState } from "./lib.mjs";
import { syncApiDocs } from "./sync-api-docs.mjs";
import { syncNotionDocs } from "./sync-notion-docs.mjs";

const force = process.argv.includes("--force");
const intervalHours = Number(process.env.DOCS_SYNC_INTERVAL_HOURS || 6);

loadEnv();

const state = readState();
const last = state.lastSync ? new Date(state.lastSync).getTime() : 0;
const ageHours = (Date.now() - last) / 3_600_000;

if (!force && last && ageHours < intervalHours) {
  console.log(
    `[docs-sync] up to date (synced ${ageHours.toFixed(1)}h ago, ` +
      `interval ${intervalHours}h) - use --force to override`
  );
  process.exit(0);
}

const results = await Promise.allSettled([syncApiDocs(), syncNotionDocs()]);
for (const r of results) {
  if (r.status === "fulfilled") console.log(`[docs-sync] ${r.value.message}`);
  else console.log(`[docs-sync] task crashed: ${r.reason}`);
}

writeState({ ...state, lastSync: new Date().toISOString() });
process.exit(0);
