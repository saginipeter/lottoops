import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import tailwind from "@tailwindcss/postcss";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TvDisplayBoard } from "../../src/components/settings/tv-display-board";

test.use({ deviceScaleFactor: 3 });

// Reuse the already-installed toolchain dependencies, including under pnpm's strict resolution.
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const esbuild = createRequire(require.resolve("tsx/cli"))("esbuild");
let css: string;
const artwork = "https://tv.test/artwork.jpg";
let artworkBytes: Buffer;
let browserHarness: string;
const TV_CARD_WIDTH_PX = 3 * 96 / 2.54;
const TV_CARD_HEIGHT_PX = 5 * 96 / 2.54;
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };

function slot(index: number, currentTicket = 21, nextTicket = 22, remaining = 130) {
  return {
    id: `display-${index}`, packId: `pack-${index}`, gameId: `game-${index}`, slotNumber: String(index + 1),
    gameName: "Triple 777", gameNumber: "1234", gameImage: artwork, ticketPrice: 5,
    sellDirection: "FIRST" as const, firstTicket: 1, currentTicket, nextTicket,
    remaining, sold: 150 - remaining, quantity: 150,
  };
}

async function showBoard(page: Page, count: number, kioskMode = true) {
  const slots = Array.from({ length: count }, (_, index) => slot(index));
  await page.setContent(renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: router,
  }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 15 }))));
  await page.addStyleTag({ content: css });
}

async function mountLiveBoard(page: Page) {
  page.on("pageerror", error => console.error("TV browser harness:", error.message));
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: browserHarness });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");
}

test.beforeAll(async () => {
  const root = resolve(__dirname, "../..");
  const from = resolve(root, "src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(from, "utf8"), { from })).css;
  artworkBytes = await readFile(resolve(root, "public/tv/game-types/triple-777-tile.jpeg"));
  const result = await esbuild.build({
    stdin: {
      resolveDir: root,
      sourcefile: "tv-browser-test.tsx",
      loader: "tsx",
      contents: `
        import React, { use, useState } from "react";
        import { createRoot } from "react-dom/client";
        import { flushSync } from "react-dom";
        import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
        import { TvDisplayBoard } from "./src/components/settings/tv-display-board";
        import { getDisplayedTicketNumber, getNextDisplayedTicket } from "./src/lib/tv-display";
        let remote = { remaining: 130, direction: "FIRST", packId: "pack-first", gameId: "game-first" };
        let delay = false;
        let fail = false;
        let pending;
        let setData;
        let stamp = Date.now();
        const initial = { ...remote, verifiedAt: stamp };
        const initialData = Promise.resolve(initial);
        window.__tvTest = {
          refreshCalls: 0,
          setRemote(value) { remote = { ...remote, ...value }; },
          setDelay(value) { delay = value; },
          setFailure(value) { fail = value; },
          complete() { if (pending) { pending({ ...remote, verifiedAt: ++stamp }); pending = null; } },
          load(value) { remote = { ...remote, ...value }; flushSync(() => setData(Promise.resolve({ ...remote, verifiedAt: ++stamp }))); }
        };
        const router = {
          back() {}, forward() {}, push() {}, replace() {}, prefetch() {},
          refresh() {
            window.__tvTest.refreshCalls++;
            if (fail) return; // A failed fetch retains the last verified snapshot.
            if (delay) setData(new Promise(resolve => { pending = resolve; }));
            else setData(Promise.resolve({ ...remote, verifiedAt: ++stamp }));
          }
        };
        function Harness() {
          const [data, update] = useState(initialData);
          setData = update;
          const snapshot = use(data);
          const slots = snapshot.remaining < 0 ? [] : [{
            id: "display", packId: snapshot.packId, gameId: snapshot.gameId, slotNumber: "1",
            gameName: "Test inventory", gameNumber: "1234", ticketPrice: 5,
            sellDirection: snapshot.direction, firstTicket: 1, quantity: 150,
            remaining: snapshot.remaining, sold: 150 - snapshot.remaining,
            currentTicket: getDisplayedTicketNumber(1, snapshot.remaining, 150, snapshot.direction),
            nextTicket: getNextDisplayedTicket(1, snapshot.remaining, 150, snapshot.direction),
          }];
          return <AppRouterContext.Provider value={router}><TvDisplayBoard
            slots={slots} kioskMode refreshSeconds={5} verifiedAt={snapshot.verifiedAt}
          /></AppRouterContext.Provider>;
        }
        createRoot(document.getElementById("root")).render(<Harness />);
      `,
    },
    bundle: true, platform: "browser", format: "iife", write: false, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  browserHarness = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route(artwork, route => route.fulfill({ body: artworkBytes, contentType: "image/jpeg" }));
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  for (const kioskMode of [false, true]) {
    test(`40 displays preserve dimensions and unobscured gold indicators at ${viewport.width}px (${kioskMode ? "kiosk" : "preview"})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await showBoard(page, 40, kioskMode);
      const cards = page.locator("article");
      await expect(cards).toHaveCount(40);
      if (kioskMode) {
        const pageFitsViewport = await page.evaluate(() => ({
          height: document.documentElement.scrollHeight <= window.innerHeight,
          width: document.documentElement.scrollWidth <= window.innerWidth,
        }));
        expect(pageFitsViewport.height).toBe(true);
        expect(pageFitsViewport.width).toBe(true);

        const board = page.locator(".tv-board-stack");
        const scrollResult = await board.evaluate((element) => {
          const last = element.lastElementChild as HTMLElement;
          const boardRect = element.getBoundingClientRect();
          element.scrollTop = element.scrollHeight;
          const lastRect = last.getBoundingClientRect();
          return {
            scrollable: element.scrollHeight > element.clientHeight,
            lastCardReached: lastRect.top >= boardRect.top && lastRect.bottom <= boardRect.bottom,
          };
        });
        if (viewport.width === 1280) expect(scrollResult.scrollable).toBe(true);
        expect(scrollResult.lastCardReached).toBe(true);
      }
      // One DOM snapshot avoids thousands of slow browser protocol calls, especially in WebKit.
      const snapshots = await cards.evaluateAll(elements => elements.map(card => {
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const badges = [...card.querySelectorAll(".tv-ticket-badge")].map(badge => {
          const circle = badge.querySelector(".tv-ticket-circle")!;
          const face = badge.querySelector(".tv-ticket-face")!;
          const label = badge.querySelector(".tv-ticket-label")!;
          return { circle: rect(circle), face: rect(face), number: rect(badge.querySelector(".tv-ticket-number")!),
            label: rect(label), circleRadius: getComputedStyle(circle).borderRadius,
            faceRadius: getComputedStyle(face).borderRadius, labelFits: label.scrollWidth <= label.clientWidth };
        });
        return { dimensions: rect(card), badges, objectFit: getComputedStyle(card.querySelector(".tv-jackpot-art")!).objectFit,
          backgroundImage: getComputedStyle(card.querySelector(".tv-ticket-indicators")!).backgroundImage };
      }));
      for (const { dimensions, badges, objectFit, backgroundImage } of snapshots) {
        expect(dimensions.width).toBeCloseTo(TV_CARD_WIDTH_PX, 0);
        expect(dimensions.height).toBeCloseTo(TV_CARD_HEIGHT_PX, 0);
        expect(badges[0].circle.width).toBeGreaterThan(badges[1].circle.width * 1.3);
        expect(badges[0].circle.x + badges[0].circle.width).toBeLessThan(badges[1].circle.x);
        for (const { face, number, label, circleRadius, faceRadius, labelFits } of badges) {
          expect(circleRadius).toBe("50%");
          expect(faceRadius).toBe("50%");
          expect(Math.abs(number.x + number.width / 2 - (face.x + face.width / 2))).toBeLessThan(1);
          expect(Math.abs(number.y + number.height / 2 - (face.y + face.height / 2))).toBeLessThan(1);
          expect(number.width).toBeLessThan(face.width);
          expect(label.y).toBeGreaterThanOrEqual(face.y + face.height);
          expect(label.y + label.height).toBeLessThanOrEqual(dimensions.y + dimensions.height);
          expect(labelFits).toBe(true);
          for (const visible of [number, label]) {
            expect(visible.width).toBeGreaterThan(0);
            expect(visible.height).toBeGreaterThan(0);
            expect(visible.x).toBeGreaterThanOrEqual(0);
            expect(visible.x + visible.width).toBeLessThanOrEqual(viewport.width);
            expect(visible.y).toBeGreaterThanOrEqual(dimensions.y);
            expect(visible.y + visible.height).toBeLessThanOrEqual(dimensions.y + dimensions.height);
          }
        }
        expect(objectFit).toBe("cover");
        expect(backgroundImage).toBe("none");
      }
    });
  }
}

test("one-, two-, and three-digit numbers scale with their circle, including pulse extremes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const value of [1, 21, 150]) {
    await page.setContent(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
      createElement(TvDisplayBoard, { slots: [slot(0, value, value - 1, 150)], kioskMode: true, refreshSeconds: 15 }))));
    await page.addStyleTag({ content: css });
    for (const scale of [1, 2]) {
      // Test-only resizing baseline is exactly 3cm x 5cm; production dimensions stay fixed.
      await page.locator("article").evaluate((el, scale) => {
        el.style.width = `${3 * scale}cm`; el.style.height = `${5 * scale}cm`; el.style.flex = `0 0 ${3 * scale}cm`;
      }, scale);
      for (const phase of ["0s", "-1.2s"]) {
        await page.locator(".tv-ticket-circle").evaluateAll((els, phase) => els.forEach(el => {
          (el as HTMLElement).style.animationDelay = phase;
          (el as HTMLElement).style.animationPlayState = "paused";
        }), phase);
        for (const badge of await page.locator(".tv-ticket-badge").all()) {
          const face = await badge.locator(".tv-ticket-face").boundingBox();
          const number = await badge.locator(".tv-ticket-number").boundingBox();
          expect(number!.width).toBeLessThan(face!.width);
          expect(number!.height).toBeLessThan(face!.height);
          expect(Math.abs(number!.x + number!.width / 2 - face!.x - face!.width / 2)).toBeLessThan(1);
          expect(Math.abs(number!.y + number!.height / 2 - face!.y - face!.height / 2)).toBeLessThan(1);
        }
      }
    }
  }
});

test("polling loads confirmed FIRST/LAST sales, pack transitions, and sold-out states without timer counting", async ({ page }) => {
  await page.clock.install();
  await mountLiveBoard(page);
  const current = page.locator(".tv-ticket-badge-current .tv-ticket-number");
  const next = page.locator(".tv-ticket-badge-next .tv-ticket-number");
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("21"); // Polling alone never advances inventory.
  await expect(next).toHaveText("22");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 129 }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("22");
  await expect(next).toHaveText("23");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 150, direction: "LAST", packId: "pack-last", gameId: "game-last" }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("150");
  await expect(next).toHaveText("149");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 149 }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("149");
  await expect(next).toHaveText("148");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 1 }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("1");
  await expect(next).toHaveText("—");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 0 }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("—");
  await expect(next).toHaveText("—");
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: -1 })); // Cleared slot after final sale.
  await page.clock.fastForward(5000);
  await expect(page.getByText("No games on display")).toBeVisible();
});

test("slow/failed refreshes keep real counts, avoid duplicate requests, and show a stale warning", async ({ page }) => {
  await page.clock.install();
  await mountLiveBoard(page);
  await page.evaluate(() => { (window as any).__tvTest.setDelay(true); (window as any).__tvTest.setRemote({ remaining: 129 }); });
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => (window as any).__tvTest.refreshCalls)).toBe(1);
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => (window as any).__tvTest.refreshCalls)).toBe(1);
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");
  await page.evaluate(() => { (window as any).__tvTest.complete(); (window as any).__tvTest.setDelay(false); (window as any).__tvTest.setFailure(true); });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("22");
  await page.clock.fastForward(12000);
  await expect(page.getByText("Updates delayed.")).toBeVisible();
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("22");
  await page.evaluate(() => (window as any).__tvTest.setFailure(false));
  await page.clock.fastForward(5000);
  await page.clock.fastForward(1000);
  await expect(page.getByText("Updates delayed.")).toHaveCount(0);
});

test("capture the implemented ticket design preview", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "chromium", "One preview artifact is enough.");
  await page.setViewportSize({ width: 1920, height: 1080 });
  const samples = [slot(0, 21, 22, 130), slot(1, 150, 149, 150), slot(2, 1, 0, 1), slot(3, 0, 0, 0)];
  await page.setContent(renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(TvDisplayBoard, { slots: samples, kioskMode: true, refreshSeconds: 15 }))));
  await page.addStyleTag({ content: css });
  await page.locator("img").first().evaluate((el: HTMLImageElement) => el.decode());
  await page.addStyleTag({ content: ".tv-ticket-circle { animation: none !important; }" });
  const output = process.env.TV_PREVIEW_DIR;
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, "tv-ticket-1080p.png") });
    const box = await page.locator(".tv-board-stack").boundingBox();
    await page.screenshot({ path: resolve(output, "tv-ticket-preview.png"), clip: {
      x: box!.x,
      y: box!.y,
      width: 4 * TV_CARD_WIDTH_PX + 3 * 4 + 16,
      height: TV_CARD_HEIGHT_PX + 16,
    } });
  }
  await testInfo.attach("Implemented TV indicators (test inventory)", { body: await page.screenshot(), contentType: "image/png" });
});
