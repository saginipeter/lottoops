import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service worker never intercepts documents or API requests and removes old app caches", async () => {
  const script = await readFile(new URL("../../../public/sw.js", import.meta.url), "utf8");
  assert.match(script, /if \(request\.destination === "document"\) return/);
  assert.match(script, /const PUBLIC_BRAND_PATHS = new Set\(\[/);
  assert.match(script, /request\.destination !== "image" \|\| !PUBLIC_BRAND_PATHS\.has\(pathname\)/);
  assert.match(script, /\bprivate\|no-store\|no-cache\b/);
  assert.match(script, /response\.type === "basic"/);
  assert.doesNotMatch(script, /pathname\.startsWith\("\/brand\/"\)/);
  assert.match(script, /keys\.filter\(\(key\) => key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME\)/);
  assert.doesNotMatch(script, /caches\.match\(request\).*document/);
  assert.doesNotMatch(script, /respondWith\([\s\S]*fetch\(request\)[\s\S]*cache\.match/);
});
