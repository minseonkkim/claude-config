// Pulls configured PUBLIC Notion pages into .claude/docs/*.md.
//
// No token: the pages are published to web, so notion-client's unofficial
// API can read them anonymously. Page -> filename map lives in
// scripts/notion-docs.config.json.
//
// Missing/invalid config is skipped cleanly so the rest of the sync (and the
// Claude session) is never blocked.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv, writeIfChanged, PROJECT_ROOT } from "./lib.mjs";
import { recordMapToMarkdown } from "./notion-md.mjs";

const CONFIG_FILE = path.join(PROJECT_ROOT, "scripts", "notion-docs.config.json");

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return Array.isArray(raw.pages) ? raw.pages : [];
  } catch {
    return null;
  }
}

export async function syncNotionDocs() {
  const pages = loadConfig();
  if (!pages) {
    return {
      ok: false,
      skipped: true,
      message:
        "Notion: skipped (scripts/notion-docs.config.json missing or invalid)",
    };
  }
  if (pages.length === 0) {
    return { ok: false, skipped: true, message: "Notion: skipped (no pages configured)" };
  }

  let NotionAPI;
  try {
    ({ NotionAPI } = await import("notion-client"));
  } catch {
    return {
      ok: false,
      message: "Notion: dependency missing - run `npm i -D notion-client notion-utils`",
    };
  }

  const api = new NotionAPI();
  const details = [];
  let failures = 0;
  let skipped = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Skip the sub-requests our converter never uses (embedded collections,
  // signed file urls) - this is the single biggest 429 reducer.
  const PAGE_OPTS = {
    fetchCollections: false,
    signFileUrls: false,
    fetchMissingBlocks: false,
  };

  // Notion's unofficial API rate-limits aggressively (429). Retry with
  // exponential backoff + jitter before giving up on a page.
  async function getPage(pageId) {
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await api.getPage(pageId, PAGE_OPTS);
      } catch (err) {
        lastErr = err;
        const is429 = String(err?.message || "").includes("429");
        if (!is429 && attempt >= 1) break;
        await sleep(1500 * 2 ** attempt + Math.random() * 500);
      }
    }
    throw lastErr;
  }

  // Serial with light pacing: concurrency is what triggers the rate limit.
  for (const page of pages) {
    if (!page.pageId || !page.output) {
      failures++;
      details.push("  - invalid entry (needs pageId + output)");
      continue;
    }
    try {
      const recordMap = await getPage(page.pageId);
      const md = recordMapToMarkdown(recordMap, page.pageId);
      if (!md || md.trim().length === 0) {
        // Section/container pages legitimately have no body text.
        skipped++;
        details.push(`  - skipped (no body): ${page.output}`);
      } else {
        const result = writeIfChanged(page.output, md);
        details.push(`  - ${result}: ${page.output}`);
      }
    } catch (err) {
      failures++;
      details.push(`  - FAILED: ${page.output} (${err.message})`);
    }
    await sleep(250);
  }
  details.sort();

  const written = pages.length - failures - skipped;
  return {
    ok: failures === 0,
    message:
      `Notion: ${written}/${pages.length} written` +
      (skipped ? `, ${skipped} skipped` : "") +
      (failures ? `, ${failures} failed` : "") +
      "\n" +
      details.join("\n"),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const r = await syncNotionDocs();
  console.log(r.message);
  process.exit(r.ok || r.skipped ? 0 : 1);
}
