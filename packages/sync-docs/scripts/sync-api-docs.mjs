// Pulls the live FastAPI OpenAPI spec into .claude/docs/api.json.
//
// Resolution order for the spec URL:
//   1. API_DOCS_URL            - full URL to the openapi json (wins if set)
//   2. API_BASE_URL            - "<base>/openapi.json"
//   3. REACT_APP_BASE_URL      - "<base>/openapi.json"  (from .env, local dev)
import { pathToFileURL } from "node:url";
import { loadEnv, writeIfChanged } from "./lib.mjs";

const OUTPUT = "api.json";

function resolveUrl() {
  if (process.env.API_DOCS_URL) return process.env.API_DOCS_URL.trim();
  const base = (
    process.env.API_BASE_URL ||
    process.env.REACT_APP_BASE_URL ||
    ""
  ).trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/openapi.json`;
}

export async function syncApiDocs() {
  const url = resolveUrl();
  if (!url) {
    return {
      ok: false,
      skipped: true,
      message:
        "API: skipped (no API_DOCS_URL / API_BASE_URL / REACT_APP_BASE_URL set)",
    };
  }

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (err) {
    return { ok: false, message: `API: fetch failed (${err.message}) - ${url}` };
  }
  if (!res.ok) {
    return { ok: false, message: `API: HTTP ${res.status} from ${url}` };
  }

  let spec;
  try {
    spec = await res.json();
  } catch {
    return { ok: false, message: `API: response was not valid JSON (${url})` };
  }
  if (!spec || typeof spec.openapi !== "string" || !spec.paths) {
    return {
      ok: false,
      message: `API: response is not an OpenAPI document (${url})`,
    };
  }

  const result = writeIfChanged(OUTPUT, JSON.stringify(spec, null, 2) + "\n");
  return { ok: true, message: `API: ${result} (${OUTPUT}) from ${url}` };
}

// Allow running this file on its own: `node scripts/sync-api-docs.mjs`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const r = await syncApiDocs();
  console.log(r.message);
  process.exit(r.ok || r.skipped ? 0 : 1);
}
