import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const esbuild = createRequire(require.resolve("tsx/cli"))("esbuild");
let bundle: string;
const imageBase = "https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/";
const games = [
  { id: "g1", gameNumber: "2753", name: "Crossword", imageUrl: null, price: 20, ticketsPerPack: 25, active: true, updatedAt: "2026-10-25" },
  { id: "g2", gameNumber: "2769", name: "Lucky 7 Doubler", imageUrl: null, price: 10, ticketsPerPack: 50, active: true, updatedAt: "2026-10-25" },
];

test.beforeAll(async () => {
  const result = await esbuild.build({
    stdin: { loader: "tsx", resolveDir: resolve(__dirname, "../.."), sourcefile: "games-artwork-browser.tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { GamesManager } from "./src/components/games/games-manager";
      window.mountGames = (games, role = "MANAGER") => createRoot(document.getElementById("root")).render(<GamesManager initialGames={games} userRole={role} />);
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  bundle = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route("https://lottoops.test/games", route => route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' }));
  await page.route(`${imageBase}**`, route => route.fulfill({ status: 404 }));
  await page.goto("https://lottoops.test/games");
  await page.addScriptTag({ content: bundle });
});

test("Games has read-only artwork status and no manual file/upload/replace controls", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), games);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(2);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /upload|replace/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(2);
});

test("legacy uploads are not presented as official Texas Lottery artwork", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), [{ ...games[0], imageUrl: "https://uploads.example/old-image.png" }]);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByText("Texas Lottery", { exact: true })).toHaveCount(0);
});

test("sync refreshes store Games artwork and catalog, preserving the exact game-image association", async ({ page }) => {
  const calls: string[] = [];
  const updated = games.map(game => ({ ...game, imageUrl: `${imageBase}${game.gameNumber}_img1.gif` }));
  await page.route("https://lottoops.test/api/games/sync", route => { calls.push("sync"); return route.fulfill({ json: { success: true, summary: { processed: 2, artworkFound: 2, sourceFailures: [] } } }); });
  await page.route("https://lottoops.test/api/games/catalog", route => { calls.push("catalog"); return route.fulfill({ json: { catalog: [], total: 0, lastSyncedAt: "2026-10-25" } }); });
  await page.route("https://lottoops.test/api/games?**", route => { calls.push("games"); return route.fulfill({ json: { games: updated } }); });
  // The test reuses a tiny existing PNG; image bytes are irrelevant to game association.
  const { readFile } = await import("node:fs/promises");
  const image = await readFile(resolve(__dirname, "../../public/brand/lottoops-logo-new.png"));
  await page.route(`${imageBase}**`, route => route.fulfill({ contentType: "image/png", body: image }));
  await page.evaluate(games => (window as any).mountGames(games), games);
  await page.getByRole("button", { name: /Sync Lottery Scratch_off/ }).click();
  await expect.poll(() => calls.includes("games") && calls.includes("catalog")).toBe(true);
  await page.getByRole("button", { name: /Store Games/ }).click();
  const first = page.locator("tr").filter({ has: page.getByText("Crossword", { exact: true }) });
  const second = page.locator("tr").filter({ has: page.getByText("Lucky 7 Doubler", { exact: true }) });
  await expect(first.locator("img")).toHaveAttribute("src", `${imageBase}2753_img1.gif`);
  await expect(second.locator("img")).toHaveAttribute("src", `${imageBase}2769_img1.gif`);
  await expect(page.getByText("Texas Lottery", { exact: true })).toHaveCount(2);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("a failed official image becomes Image not available rather than displaying another game's artwork", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), [{ ...games[0], imageUrl: `${imageBase}2753_img1.gif` }]);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
});
