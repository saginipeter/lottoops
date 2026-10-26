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

test("Games shows artwork replacement actions without opening upload controls by default", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), games);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(2);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Artwork", exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(2);
});

test("Managers can select and replace a game artwork from the game editor", async ({ page }) => {
  const customImage = "https://store-1.public.blob.vercel-storage.com/stores/store-1/games/g1/artwork/custom.png";
  const updatedGames = [{ ...games[0], imageUrl: customImage }, games[1]];
  const { readFile } = await import("node:fs/promises");
  const image = await readFile(resolve(__dirname, "../../public/brand/lottoops-logo-new.png"));

  await page.route("https://lottoops.test/api/games/g1/artwork", route => route.fulfill({ json: {
    success: true,
    message: "Crossword artwork replaced successfully.",
    game: { id: "g1", imageUrl: customImage },
  } }));
  await page.route("https://lottoops.test/api/games?includeInactive=true", route => route.fulfill({ json: { games: updatedGames } }));
  await page.route("https://store-1.public.blob.vercel-storage.com/**", route => route.fulfill({ contentType: "image/png", body: image }));
  await page.evaluate(games => (window as any).mountGames(games), games);

  await page.getByRole("button", { name: "Artwork", exact: true }).first().click();
  await expect(page.getByText("Edit Game & Artwork", { exact: true })).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({ name: "custom-artwork.png", mimeType: "image/png", buffer: Buffer.from("fake-image") });
  await expect(page.getByText("custom-artwork.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Replace artwork", exact: true }).click();
  await expect(page.getByText("Crossword artwork replaced successfully.", { exact: true })).toBeVisible();
  await expect(page.getByText("Custom artwork", { exact: true }).first()).toBeVisible();
});

test("legacy uploads are not presented as official Texas Lottery artwork", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), [{ ...games[0], imageUrl: "https://uploads.example/old-image.png" }]);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByText("Texas Lottery", { exact: true })).toHaveCount(0);
});

test("sync refreshes store Games artwork and catalog, preserving the exact game-image association", async ({ page }) => {
  const calls: string[] = [];
  const updated = games.map(game => ({ ...game, imageUrl: `${imageBase}${game.gameNumber}_200X200.gif` }));
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
  await expect(first.locator("img")).toHaveAttribute("src", `${imageBase}2753_200X200.gif`);
  await expect(second.locator("img")).toHaveAttribute("src", `${imageBase}2769_200X200.gif`);
  await expect(page.getByText("Texas Lottery", { exact: true })).toHaveCount(2);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("a full ticket front is not displayed as valid promotional artwork", async ({ page }) => {
  await page.evaluate(games => (window as any).mountGames(games), [{ ...games[0], imageUrl: `${imageBase}2753_img1.gif` }]);
  await expect(page.getByText("Image not available", { exact: true })).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByText("Texas Lottery", { exact: true })).toHaveCount(0);
});
