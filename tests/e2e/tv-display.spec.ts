import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TvDisplayBoard } from "../../src/components/settings/tv-display-board";

let css: string;

test.beforeAll(async () => {
  const from = resolve(__dirname, "../../src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(from, "utf8"), { from })).css;
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  for (const kioskMode of [false, true]) {
    for (const count of [20, 40]) {
      test(`${count} TV slots keep ticket numbers unobscured at ${viewport.width}px in ${kioskMode ? "kiosk" : "preview"}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const slots = Array.from({ length: count }, (_, index) => ({
          id: `slot-${index}`, packId: `pack-${index}`, slotNumber: String(index + 1),
          gameName: `Game ${index + 1}`, gameNumber: "1234", ticketPrice: 1,
          sellDirection: "FIRST" as const, firstTicket: 1, currentTicket: 12,
          nextTicket: 13, remaining: 39, sold: 11, quantity: 50,
        }));
        const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
        await page.setContent(renderToStaticMarkup(createElement(AppRouterContext.Provider, {
          value: router,
        }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 30 }))));
        await page.addStyleTag({ content: css });

        const cards = page.locator("article");
        await expect(cards).toHaveCount(count);
        const bounds = await cards.evaluateAll((elements) => elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        }));
        for (let index = 0; index < count - 5; index++) {
          expect(bounds[index].bottom).toBeLessThanOrEqual(bounds[index + 5].top);
        }

        for (let index = 0; index < count; index++) {
          const card = cards.nth(index);
          for (const [label, value] of [["CURRENT TICKET", "12"], ["NEXT TICKET", "13"]]) {
            const heading = card.getByText(label, { exact: true });
            const number = heading.locator("..").getByText(value, { exact: true });
            if (!kioskMode || count > 20) await number.scrollIntoViewIfNeeded();
            await expect(heading).toBeInViewport({ ratio: 1 });
            await expect(number).toBeInViewport({ ratio: 1 });
            expect(await number.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              return hit === element || element.contains(hit);
            })).toBe(true);
          }
        }
      });
    }
  }
}
