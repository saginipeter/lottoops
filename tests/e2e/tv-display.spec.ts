import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import tailwind from "@tailwindcss/postcss";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TvDisplayBoard } from "../../src/components/settings/tv-display-board";

test.use({ deviceScaleFactor: 3 });

const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const esbuild = createRequire(require.resolve("tsx/cli"))("esbuild");
const artwork = "https://tv.test/artwork.jpg";
const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };

let css: string;
let artworkBytes: Buffer;
let browserHarness: string;

type TestSlot = {
  id: string;
  packId: string;
  gameId: string;
  slotNumber: string;
  gameName: string;
  gameNumber: string;
  gameImage?: string | null;
  ticketPrice: number;
  sellDirection: "FIRST" | "LAST";
  firstTicket: number;
  currentTicket: number;
  nextTicket: number;
  remaining: number;
  sold: number;
  quantity: number;
};

type CardRect = { x: number; y: number; width: number; height: number };

function slot(slotNumber: number | string, overrides: Partial<TestSlot> = {}): TestSlot {
  const number = String(slotNumber);
  const currentTicket = overrides.currentTicket ?? 21;
  const remaining = overrides.remaining ?? 130;
  return {
    id: `display-${number}`,
    packId: `pack-${number}`,
    gameId: `game-${number}`,
    slotNumber: number,
    gameName: `Game ${number}`,
    gameNumber: number.padStart(4, "0"),
    gameImage: artwork,
    ticketPrice: 5,
    sellDirection: "FIRST",
    firstTicket: 1,
    currentTicket,
    nextTicket: overrides.nextTicket ?? currentTicket + 1,
    remaining,
    sold: 150 - remaining,
    quantity: 150,
    ...overrides,
  };
}

function slotsFor(count: number, reverse = true): TestSlot[] {
  const values = Array.from({ length: count }, (_, index) => index + 1);
  if (reverse) values.reverse();
  return values.map((value) => slot(value));
}

function groupRows<T extends { dimensions: CardRect }>(cards: T[]): T[][] {
  const rows: T[][] = [];
  for (const card of cards) {
    const row = rows.find((candidate) => Math.abs(candidate[0].dimensions.y - card.dimensions.y) < 1);
    if (row) row.push(card);
    else rows.push([card]);
  }
  return rows;
}

async function showBoard(
  page: Page,
  slotsOrCount: TestSlot[] | number,
  kioskMode = true,
  screenNumber = 1,
  kioskToken?: string,
  refreshSeconds = 15,
) {
  const slots = typeof slotsOrCount === "number" ? slotsFor(slotsOrCount) : slotsOrCount;
  const markup = renderToStaticMarkup(createElement(
    AppRouterContext.Provider,
    { value: router },
    createElement(TvDisplayBoard, {
      slots,
      kioskMode,
      refreshSeconds,
      kioskToken,
      screenNumber,
    }),
  ));
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>${markup}</body></html>`);
  await page.addStyleTag({ content: css });
}

async function gridSnapshot(page: Page) {
  return page.locator(".tv-board-stack").evaluate((element) => {
    const rect = (node: Element): CardRect => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const styles = getComputedStyle(element);
    const cards = [...element.querySelectorAll("article")].map((card) => ({
      dimensions: rect(card),
      badges: [...card.querySelectorAll(".tv-ticket-badge")].map((badge) => {
        const circle = badge.querySelector(".tv-ticket-circle")!;
        const face = badge.querySelector(".tv-ticket-face")!;
        const number = badge.querySelector(".tv-ticket-number")!;
        const label = badge.querySelector(".tv-ticket-label")!;
        return {
          circle: rect(circle),
          face: rect(face),
          number: rect(number),
          label: rect(label),
          numberFits: number.scrollWidth <= number.clientWidth + 1,
          labelFits: label.scrollWidth <= label.clientWidth + 1,
          circleRadius: getComputedStyle(circle).borderRadius,
          faceRadius: getComputedStyle(face).borderRadius,
        };
      }),
    }));
    const board = element.getBoundingClientRect();
    return {
      display: styles.display,
      gridTemplateColumns: styles.gridTemplateColumns,
      gridTemplateRows: styles.gridTemplateRows,
      columnGap: parseFloat(styles.columnGap || "0"),
      rowGap: parseFloat(styles.rowGap || "0"),
      board: { x: board.x, y: board.y, width: board.width, height: board.height },
      cards,
      boardScrollHeight: element.scrollHeight,
      boardClientHeight: element.clientHeight,
      boardScrollWidth: element.scrollWidth,
      boardClientWidth: element.clientWidth,
    };
  });
}

async function displayedSlotNumbers(page: Page): Promise<number[]> {
  return page.locator(".tv-display-number").evaluateAll((elements) =>
    elements.map((element) => Number(element.textContent?.trim())).filter(Number.isFinite),
  );
}

async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }));
}

async function hrefQuery(page: Page, name: string) {
  const raw = await page.getByRole("link", { name, exact: true }).getAttribute("href");
  expect(raw).toBeTruthy();
  return new URL(raw!, "http://tv.test/tv-display");
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
        let remote = { remaining: 130, direction: "FIRST", packId: "pack-first", gameId: "game-first", inventoryCount: 1 };
        let delay = false;
        let fail = false;
        let pending;
        let setData;
        let stamp = Date.now();
        const initial = { ...remote, screenNumber: 1, verifiedAt: stamp };
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
          back() {}, forward() {}, push() {}, prefetch() {},
          replace(path) {
            const screenNumber = Number(new URL(path, "http://tv.test").searchParams.get("screen") || 1);
            flushSync(() => setData(Promise.resolve({ ...remote, screenNumber, verifiedAt: ++stamp })));
          },
          refresh() {
            window.__tvTest.refreshCalls++;
            if (fail) return;
            if (delay) setData(new Promise(resolve => { pending = resolve; }));
            else setData(Promise.resolve({ ...remote, verifiedAt: ++stamp }));
          }
        };
        function Harness() {
          const [data, update] = useState(initialData);
          setData = update;
          const snapshot = use(data);
          const slots = snapshot.remaining < 0 ? [] : Array.from({ length: snapshot.inventoryCount }, (_, index) => ({
            id: "display-" + (index + 1), packId: snapshot.packId, gameId: snapshot.gameId + "-" + (index + 1), slotNumber: String(index + 1),
            gameName: "Test inventory", gameNumber: "1234", gameImage: "https://tv.test/artwork.jpg", ticketPrice: 5,
            sellDirection: snapshot.direction, firstTicket: 1, quantity: 150,
            remaining: snapshot.remaining, sold: 150 - snapshot.remaining,
            currentTicket: getDisplayedTicketNumber(1, snapshot.remaining, 150, snapshot.direction),
            nextTicket: getNextDisplayedTicket(1, snapshot.remaining, 150, snapshot.direction),
          }));
          return <AppRouterContext.Provider value={router}><TvDisplayBoard
            slots={slots} kioskMode refreshSeconds={5} screenNumber={snapshot.screenNumber} kioskToken="signed-kiosk-token" verifiedAt={snapshot.verifiedAt}
          /></AppRouterContext.Provider>;
        }
        createRoot(document.getElementById("root")).render(<Harness />);
      `,
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  browserHarness = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route(artwork, (route) => route.fulfill({ body: artworkBytes, contentType: "image/jpeg" }));
});

for (const viewport of [
  { name: "desktop 720p", width: 1280, height: 720 },
  { name: "desktop 1080p", width: 1920, height: 1080 },
  { name: "mobile 390px", width: 390, height: 844 },
]) {
  test(`40 cards fit a 10-column by 4-row kiosk grid at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await showBoard(page, 40, true);

    const snapshot = await gridSnapshot(page);
    expect(snapshot.display).toBe("grid");
    expect(snapshot.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(10);
    expect(snapshot.gridTemplateRows.trim().split(/\s+/)).toHaveLength(4);
    expect(snapshot.cards).toHaveLength(40);
    expect(snapshot.columnGap).toBe(viewport.width <= 900 ? 6 : 8);
    expect(snapshot.rowGap).toBe(viewport.width <= 900 ? 6 : 8);
    expect(snapshot.boardScrollHeight).toBeLessThanOrEqual(snapshot.boardClientHeight + 1);
    expect(snapshot.boardScrollWidth).toBeLessThanOrEqual(snapshot.boardClientWidth + 1);

    const rows = groupRows(snapshot.cards);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.length)).toEqual([10, 10, 10, 10]);
    for (const row of rows) {
      expect(Math.abs(row[0].dimensions.x - snapshot.board.x)).toBeLessThan(1.5);
      const right = row[row.length - 1].dimensions.x + row[row.length - 1].dimensions.width;
      expect(Math.abs(right - (snapshot.board.x + snapshot.board.width))).toBeLessThan(1.5);
    }

    // Cards are responsive cells, not the obsolete fixed 8 cm x 10 cm cards.
    expect(Math.max(...snapshot.cards.map((card) => card.dimensions.width))).toBeLessThan(300);
    expect(Math.max(...snapshot.cards.map((card) => card.dimensions.height))).toBeLessThan(380);
    for (const card of snapshot.cards) {
      expect(card.dimensions.width).toBeGreaterThan(0);
      expect(card.dimensions.height).toBeGreaterThan(0);
      for (const badge of card.badges) {
        expect(badge.circleRadius).toBe("50%");
        expect(badge.faceRadius).toBe("50%");
        expect(Math.abs(badge.circle.width - badge.circle.height)).toBeLessThan(1.5);
        expect(Math.abs(badge.face.width - badge.face.height)).toBeLessThan(1.5);
        expect(badge.numberFits).toBe(true);
        expect(badge.labelFits).toBe(true);
        expect(Math.abs(
          badge.number.x + badge.number.width / 2 - (badge.face.x + badge.face.width / 2),
        )).toBeLessThan(1.5);
        expect(Math.abs(
          badge.number.y + badge.number.height / 2 - (badge.face.y + badge.face.height / 2),
        )).toBeLessThan(1.5);
        expect(badge.label.x).toBeGreaterThanOrEqual(card.dimensions.x - 1);
        expect(badge.label.x + badge.label.width).toBeLessThanOrEqual(card.dimensions.x + card.dimensions.width + 1);
        expect(badge.label.y).toBeGreaterThanOrEqual(card.dimensions.y - 1);
        expect(badge.label.y + badge.label.height).toBeLessThanOrEqual(card.dimensions.y + card.dimensions.height + 1);
      }
    }

    const visual = await page.locator("article").first().evaluate((card) => {
      const current = card.querySelector(".tv-ticket-badge-current .tv-ticket-circle")!;
      const next = card.querySelector(".tv-ticket-badge-next .tv-ticket-circle")!;
      const displayNumber = card.querySelector(".tv-display-number")!;
      const priceBadge = card.querySelector(".tv-price-badge")!;
      const displayBadge = card.querySelector(".tv-display-badge")!;
      const ticketFace = card.querySelector(".tv-ticket-face")!;
      const artwork = card.querySelector(".tv-artwork-crop") as HTMLElement | null;
      const cardRect = card.getBoundingClientRect();
      const displayRect = displayNumber.getBoundingClientRect();
      const priceRect = priceBadge.getBoundingClientRect();
      const artworkStyle = artwork ? getComputedStyle(artwork) : null;
      return {
        currentWidth: current.getBoundingClientRect().width,
        nextWidth: next.getBoundingClientRect().width,
        currentBackground: getComputedStyle(current).backgroundImage,
        nextBackground: getComputedStyle(next).backgroundImage,
        displayNumberInHeader: displayRect.top >= cardRect.top && displayRect.bottom <= cardRect.top + cardRect.height * .28,
        priceOnLeft: priceRect.x < displayRect.x,
        artworkCropped: Boolean(artworkStyle && artworkStyle.top.startsWith("-") && artworkStyle.overflow === "hidden"),
        priceBadgeCount: card.querySelectorAll(".tv-price-badge").length,
        priceBackground: getComputedStyle(priceBadge).backgroundColor,
        displayBackground: getComputedStyle(displayBadge).backgroundColor,
        priceBorder: getComputedStyle(priceBadge).borderTopColor,
        displayBorder: getComputedStyle(displayBadge).borderTopColor,
        displayText: getComputedStyle(displayBadge).color,
        ticketFaceBackground: getComputedStyle(ticketFace).backgroundColor,
        ticketFaceBorder: getComputedStyle(ticketFace).borderTopColor,
      };
    });
    expect(Math.abs(visual.currentWidth - visual.nextWidth)).toBeLessThan(1.5);
    expect(visual.currentBackground).toContain("rgb(255, 154, 154)");
    expect(visual.nextBackground).toContain("rgb(255, 154, 154)");
    expect(visual.displayNumberInHeader).toBe(true);
    expect(visual.priceOnLeft).toBe(true);
    expect(visual.artworkCropped).toBe(true);
    expect(visual.priceBadgeCount).toBe(1);
    expect(visual.priceBackground).toBe("rgb(255, 255, 255)");
    expect(visual.displayBackground).toBe("rgb(255, 255, 255)");
    expect(visual.priceBorder).toBe("rgb(255, 255, 255)");
    expect(visual.displayBorder).toBe("rgb(255, 255, 255)");
    expect(visual.displayText).toBe("rgb(5, 5, 5)");
    expect(visual.ticketFaceBackground).toBe("rgb(255, 255, 255)");
    expect(visual.ticketFaceBorder).toBe("rgb(255, 255, 255)");
    await expect(page.locator(".tv-price-value").first()).toHaveText("$5");

    const overflow = await pageOverflow(page);
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    expect(overflow.documentHeight).toBeLessThanOrEqual(overflow.viewportHeight + 1);
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    expect(overflow.bodyHeight).toBeLessThanOrEqual(overflow.viewportHeight + 1);
  });
}

test("responsive ticket numbers 1, 21, and 150 stay centered and contained without fixed card resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const measurements: Array<{ numberWidth: number; faceWidth: number; fontSize: number; cardWidth: number; cardHeight: number }> = [];

  for (const value of [1, 21, 150]) {
    await showBoard(page, [slot(1, { currentTicket: value, nextTicket: value + 1, remaining: 150 })], true);
    const measurement = await page.locator("article").evaluate((card) => {
      const face = card.querySelector(".tv-ticket-badge-current .tv-ticket-face")!;
      const number = card.querySelector(".tv-ticket-badge-current .tv-ticket-number")!;
      const faceRect = face.getBoundingClientRect();
      const numberRect = number.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        numberWidth: numberRect.width,
        faceWidth: faceRect.width,
        fontSize: parseFloat(getComputedStyle(number).fontSize),
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        numberCenterX: numberRect.x + numberRect.width / 2,
        numberCenterY: numberRect.y + numberRect.height / 2,
        faceCenterX: faceRect.x + faceRect.width / 2,
        faceCenterY: faceRect.y + faceRect.height / 2,
        numberFits: number.scrollWidth <= number.clientWidth + 1,
      };
    });
    expect(measurement.numberFits).toBe(true);
    expect(measurement.numberWidth).toBeLessThan(measurement.faceWidth);
    expect(Math.abs(measurement.numberCenterX - measurement.faceCenterX)).toBeLessThan(1.5);
    expect(Math.abs(measurement.numberCenterY - measurement.faceCenterY)).toBeLessThan(1.5);
    expect(measurement.cardWidth).toBeLessThan(300);
    expect(measurement.cardHeight).toBeLessThan(380);
    measurements.push(measurement);
  }

  expect(measurements[0].fontSize).toBeGreaterThanOrEqual(measurements[1].fontSize);
  expect(measurements[1].fontSize).toBeGreaterThanOrEqual(measurements[2].fontSize);
  expect(measurements[0].numberWidth).toBeLessThanOrEqual(measurements[1].numberWidth);
  expect(measurements[1].numberWidth).toBeLessThan(measurements[2].numberWidth);
});

test("kiosk automatically rotates to the next physical screen and fades the new board in", async ({ page }) => {
  await page.clock.install();
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: browserHarness });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");
  await page.evaluate(() => (window as any).__tvTest.load({ inventoryCount: 41 }));
  await expect(page.locator(".tv-screen-count")).toContainText("Screen 1 of 2");
  await expect.poll(async () => displayedSlotNumbers(page)).toHaveLength(40);
  await expect(page.locator("[data-screen-number]")).toHaveAttribute("data-screen-number", "1");
  await page.clock.fastForward(15_000);
  await expect.poll(async () => page.locator("[data-screen-number]").getAttribute("data-screen-number")).toBe("2");
  await expect(page.locator(".tv-screen-count")).toContainText("Screen 2 of 2");
  await expect.poll(async () => displayedSlotNumbers(page)).toEqual([41]);
  const previousHref = await hrefQuery(page, "Previous screen");
  expect(previousHref.searchParams.get("token")).toBe("signed-kiosk-token");
  expect(previousHref.searchParams.get("screen")).toBe("1");
  const screenAnimation = await page.locator(".tv-board-stack").evaluate((element) => getComputedStyle(element).animationName);
  expect(screenAnimation).toBe("tv-screen-enter");
});

test.describe("40-entry TV screen splitting", () => {
  const cases = [40, 41, 80, 81];

  for (const count of cases) {
    test(`${count} entries show each natural slot exactly once across screens 1, 2, and 3`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const allDisplayed: number[] = [];
      const expectedPages = Math.max(1, Math.ceil(count / 40));
      const slots = slotsFor(count, true);

      for (const screenNumber of [1, 2, 3]) {
        await showBoard(page, slots, true, screenNumber);
        const displayed = await displayedSlotNumbers(page);
        expect(displayed.length).toBeLessThanOrEqual(40);
        expect(displayed).toEqual(displayed.slice().sort((left, right) => left - right));
        allDisplayed.push(...displayed);

        const first = (screenNumber - 1) * 40 + 1;
        const expected = screenNumber <= expectedPages
          ? Array.from({ length: Math.min(40, count - first + 1) }, (_, index) => first + index)
          : [];
        expect(displayed).toEqual(expected);

        if (screenNumber <= expectedPages && (expectedPages > 1 || screenNumber > 1)) {
          await expect(page.locator(".tv-screen-count")).toContainText(`Screen ${screenNumber} of ${expectedPages}`);
        } else {
          if (screenNumber > expectedPages) {
            await expect(page.getByText(`No games on Screen ${screenNumber}`, { exact: true })).toBeVisible();
          }
        }
      }

      expect(allDisplayed).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      expect(new Set(allDisplayed).size).toBe(count);
      expect(Math.max(...[1, 2, 3].map((screenNumber) =>
        screenNumber <= expectedPages ? Math.min(40, count - (screenNumber - 1) * 40) : 0,
      ))).toBeLessThanOrEqual(40);
    });
  }
});

test("screen navigation exposes only applicable links and preserves kiosk token, screen, and interval", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const token = "signed-kiosk-token";

  await showBoard(page, 40, true, 1, token, 30);
  await expect(page.getByRole("link", { name: "Previous screen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Next screen", exact: true })).toHaveCount(0);

  await showBoard(page, 81, true, 1, token, 30);
  await expect(page.getByRole("link", { name: "Previous screen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Next screen", exact: true })).toHaveCount(1);
  const nextFromFirst = await hrefQuery(page, "Next screen");
  expect(nextFromFirst.searchParams.get("screen")).toBe("2");
  expect(nextFromFirst.searchParams.get("interval")).toBe("30");
  expect(nextFromFirst.searchParams.get("token")).toBe(token);

  await showBoard(page, 81, true, 2, token, 30);
  await expect(page.getByRole("link", { name: "Previous screen", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Next screen", exact: true })).toHaveCount(1);
  const previousFromMiddle = await hrefQuery(page, "Previous screen");
  const nextFromMiddle = await hrefQuery(page, "Next screen");
  expect(previousFromMiddle.searchParams.get("screen")).toBe("1");
  expect(nextFromMiddle.searchParams.get("screen")).toBe("3");
  for (const url of [previousFromMiddle, nextFromMiddle]) {
    expect(url.searchParams.get("interval")).toBe("30");
    expect(url.searchParams.get("token")).toBe(token);
  }

  await showBoard(page, 81, true, 3, token, 30);
  await expect(page.getByRole("link", { name: "Previous screen", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Next screen", exact: true })).toHaveCount(0);
  const previousFromLast = await hrefQuery(page, "Previous screen");
  expect(previousFromLast.searchParams.get("screen")).toBe("2");
  expect(previousFromLast.searchParams.get("interval")).toBe("30");
  expect(previousFromLast.searchParams.get("token")).toBe(token);
});

test("a selected screen remains empty after inventory shrinks instead of switching to screen 1", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const token = "signed-kiosk-token";
  await showBoard(page, 41, true, 2, token, 15);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator(".tv-display-number")).toHaveText("41");

  await showBoard(page, 40, true, 2, token, 15);
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByText("No games on Screen 2", { exact: true })).toBeVisible();
  await expect(page.getByText("No games on display", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Previous screen", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Next screen", exact: true })).toHaveCount(0);
  const previous = await hrefQuery(page, "Previous screen");
  expect(previous.searchParams.get("screen")).toBe("1");
  expect(previous.searchParams.get("interval")).toBe("15");
  expect(previous.searchParams.get("token")).toBe(token);
});

test("zero inventory keeps the default No games on display state, while an explicit valid screen is not clamped", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await showBoard(page, 0, true);
  await expect(page.getByText("No games on display", { exact: true })).toBeVisible();
  await expect(page.getByText("No games on Screen 1", { exact: true })).toHaveCount(0);

  await showBoard(page, 41, true, 99);
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByText("No games on Screen 99", { exact: true })).toBeVisible();
});

test("missing artwork and out-of-stock indicators remain visible without changing the responsive board", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await showBoard(page, [slot(1, { gameImage: null, remaining: 0, currentTicket: 0, nextTicket: 0 })], true);
  await expect(page.getByRole("img", { name: "Game 1 image not available" })).toBeVisible();
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("—");
  await expect(page.locator(".tv-ticket-badge-next .tv-ticket-number")).toHaveText("—");
  const snapshot = await gridSnapshot(page);
  expect(snapshot.display).toBe("grid");
  expect(snapshot.cards).toHaveLength(1);
});

test("artwork, shine, sun-orbit, and ticket-change animations honor motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await showBoard(page, 1, true);
  await expect(page.locator("[data-live-status]")).toHaveAttribute("data-live-status", "live");
  const animated = await page.locator("article").evaluate((card) => ({
    artwork: getComputedStyle(card.querySelector(".tv-jackpot-art")!).animationName,
    shine: getComputedStyle(card, "::before").animationName,
    sunOrbit: getComputedStyle(card.querySelector(".tv-ticket-circle")!, "::before").animationName,
    ticketChange: getComputedStyle(card.querySelector(".tv-ticket-number")!).animationName,
  }));
  expect(animated).toEqual({
    artwork: "tv-artwork-drift",
    shine: "tv-artwork-shine",
    sunOrbit: "tv-sun-orbit",
    ticketChange: "tv-ticket-change",
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await showBoard(page, 1, true);
  const reduced = await page.locator("article").evaluate((card) => ({
    artwork: getComputedStyle(card.querySelector(".tv-jackpot-art")!).animationName,
    shine: getComputedStyle(card, "::before").animationName,
    sunOrbit: getComputedStyle(card.querySelector(".tv-ticket-circle")!, "::before").animationName,
    ticketChange: getComputedStyle(card.querySelector(".tv-ticket-number")!).animationName,
  }));
  expect(reduced).toEqual({ artwork: "none", shine: "none", sunOrbit: "none", ticketChange: "none" });
});

test("polling loads confirmed FIRST/LAST sales, pack transitions, and sold-out states without timer counting", async ({ page }) => {
  await page.clock.install();
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: browserHarness });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");

  const current = page.locator(".tv-ticket-badge-current .tv-ticket-number");
  const next = page.locator(".tv-ticket-badge-next .tv-ticket-number");
  const initialCurrentNode = await current.evaluateHandle((element) => element);
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("21");
  await expect(next).toHaveText("22");
  expect(await current.evaluate((element, initial) => element === initial, initialCurrentNode)).toBe(true);

  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: 129 }));
  await page.clock.fastForward(5000);
  await expect(current).toHaveText("22");
  await expect(next).toHaveText("23");
  expect(await current.evaluate((element, initial) => element === initial, initialCurrentNode)).toBe(false);

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
  await page.evaluate(() => (window as any).__tvTest.setRemote({ remaining: -1 }));
  await page.clock.fastForward(5000);
  await expect(page.getByText("No games on display", { exact: true })).toBeVisible();
});

test("slow/failed refreshes keep real counts, avoid duplicate requests, and show a stale warning", async ({ page }) => {
  await page.clock.install();
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: browserHarness });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");

  await page.evaluate(() => {
    (window as any).__tvTest.setDelay(true);
    (window as any).__tvTest.setRemote({ remaining: 129 });
  });
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => (window as any).__tvTest.refreshCalls)).toBe(1);
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => (window as any).__tvTest.refreshCalls)).toBe(1);
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("21");

  await page.evaluate(() => {
    (window as any).__tvTest.complete();
    (window as any).__tvTest.setDelay(false);
    (window as any).__tvTest.setFailure(true);
  });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("22");
  await page.clock.fastForward(12000);
  await expect(page.getByText("Updates delayed.", { exact: false })).toBeVisible();
  await expect(page.locator("[data-live-status]")).toHaveAttribute("data-live-status", "delayed");
  const delayedAnimations = await page.locator("article").evaluate((card) => ({
    artwork: getComputedStyle(card.querySelector(".tv-jackpot-art")!).animationPlayState,
    shine: getComputedStyle(card, "::before").animationPlayState,
    sunOrbit: getComputedStyle(card.querySelector(".tv-ticket-circle")!, "::before").animationPlayState,
    circle: getComputedStyle(card.querySelector(".tv-ticket-circle")!).animationPlayState,
  }));
  expect(delayedAnimations).toEqual({ artwork: "paused", shine: "paused", sunOrbit: "paused", circle: "paused" });
  await expect(page.locator(".tv-ticket-badge-current .tv-ticket-number")).toHaveText("22");

  await page.evaluate(() => (window as any).__tvTest.setFailure(false));
  await page.clock.fastForward(5000);
  await page.clock.fastForward(1000);
  await expect(page.getByText("Updates delayed.", { exact: false })).toHaveCount(0);
});
