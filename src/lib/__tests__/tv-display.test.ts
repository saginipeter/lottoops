import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TvDisplayBoard } from "@/components/settings/tv-display-board";
import {
  calculateTicketProgress,
  getDisplayRemainingTicketCount,
  getDisplayedTicketNumber,
  getNextDisplayedTicket,
} from "@/lib/tv-display";
import { remainingTicketsAfterDirectionChange, remainingTicketsFromPhysicalTicket } from "@/lib/core-validation";

test("TV slot HUDs show current and next ticket numbers in preview and kiosk modes", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const kioskMode of [false, true]) {
    const slots = (["FIRST", "LAST"] as const).map((sellDirection, index) => ({
      id: `slot-${index}`, packId: `pack-${index}`, slotNumber: String(index + 1),
      gameName: "Test game", gameNumber: "1234", ticketPrice: 1, sellDirection,
      firstTicket: 1, currentTicket: index === 0 ? 12 : 1, nextTicket: index === 0 ? 13 : 0,
      remaining: 1, sold: 49, quantity: 50,
    }));
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, {
      value: router,
    }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 30 })));
    assert.equal((html.match(/>CURRENT TICKET</g) ?? []).length, 2);
    assert.equal((html.match(/>NEXT TICKET</g) ?? []).length, 2);
    assert.equal((html.match(/>12</g) ?? []).length, 1);
    assert.match(html, />13</);
    assert.match(html, />—</);
    assert.equal((html.match(/<strong class="block tabular-nums text-\[clamp\(0\.8rem,6cqw,1\.4rem\)\] leading-tight text-white">(?:12|1)<\/strong>/g) ?? []).length, 2);
    assert.equal((html.match(/<strong class="block tabular-nums text-\[clamp\(0\.8rem,6cqw,1\.4rem\)\] leading-tight text-amber-300">(?:13|—)<\/strong>/g) ?? []).length, 2);
    assert.equal((html.match(/<article class="@container /g) ?? []).length, 2);
  }
});

test("TV display shows every game together without slides", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const kioskMode of [false, true]) {
    for (const count of [0, 1, 14, 15, 16, 30, 31]) {
      const slots = Array.from({ length: count }, (_, index) => ({
        id: `slot-${index}`, packId: `pack-${index}`, slotNumber: String(index + 1),
        gameName: `Test game ${index + 1}`, gameNumber: "1234", ticketPrice: 1,
        sellDirection: "FIRST" as const, firstTicket: 1, currentTicket: 12,
        nextTicket: 13, remaining: 38, sold: 12, quantity: 50,
      }));
      const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, {
        value: router,
      }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 30 })));
      assert.equal((html.match(/<article /g) ?? []).length, count);
      if (count === 0) {
        assert.match(html, /No games on display/);
      } else {
        assert.match(html, /grid-cols-5/);
        assert.match(html, new RegExp(`Test game ${count} lottery game artwork`));
      }
      assert.doesNotMatch(html, /aria-label="Display slides"|Previous slide|Next slide|Slide \d+ of \d+/);
      if (kioskMode && count > 15) assert.match(html, /overflow-y-auto/);
    }
  }
});

test("calculates sold tickets from a descending remaining counter", () => {
  assert.deepEqual(calculateTicketProgress(1, 97, 100), { sold: 3, remaining: 97 });
});

test("does not produce negative sold or remaining values", () => {
  assert.deepEqual(calculateTicketProgress(1, 0, 1), { sold: 1, remaining: 0 });
  assert.deepEqual(calculateTicketProgress(1, 2, 1), { sold: 0, remaining: 1 });
});

test("keeps sell-from-last packs synchronized at one remaining ticket", () => {
  assert.deepEqual(calculateTicketProgress(50, 1, 50), { sold: 49, remaining: 1 });
  assert.equal(getDisplayedTicketNumber(1, 50, 50, "LAST"), 50);
  assert.equal(getNextDisplayedTicket(1, 50, 50, "LAST"), 49);
  assert.equal(getDisplayedTicketNumber(1, 1, 50, "LAST"), 1);
  assert.equal(getNextDisplayedTicket(1, 1, 50, "LAST"), 0);
});

test("derives the next physical ticket from a normal pack", () => {
  assert.equal(getDisplayedTicketNumber(1, 50, 50), 1);
  assert.equal(getNextDisplayedTicket(1, 50, 50), 2);
  assert.equal(getDisplayedTicketNumber(1, 49, 50), 2);
});

test("starts a first-ticket pack at the first physical ticket", () => {
  assert.equal(getDisplayedTicketNumber(1, 150, 150, "FIRST"), 1);
  assert.equal(getNextDisplayedTicket(1, 150, 150, "FIRST"), 2);
});

test("derives current and next tickets when an active pack has no remaining count", () => {
  const firstDirectionRemaining = getDisplayRemainingTicketCount(null, 8, 50, "FIRST");
  assert.equal(firstDirectionRemaining, 43);
  assert.equal(getDisplayedTicketNumber(8, firstDirectionRemaining, 50, "FIRST"), 8);
  assert.equal(getNextDisplayedTicket(8, firstDirectionRemaining, 50, "FIRST"), 9);

  const lastDirectionRemaining = getDisplayRemainingTicketCount(null, 8, 50, "LAST");
  assert.equal(lastDirectionRemaining, 50);
  assert.equal(getDisplayedTicketNumber(8, lastDirectionRemaining, 50, "LAST"), 50);
  assert.equal(getNextDisplayedTicket(8, lastDirectionRemaining, 50, "LAST"), 49);
});

test("preserves an explicit sold-out remaining count", () => {
  assert.equal(getDisplayRemainingTicketCount(0, 1, 50, "FIRST"), 0);
  assert.equal(getDisplayedTicketNumber(1, 0, 50, "FIRST"), 0);
  assert.equal(getNextDisplayedTicket(1, 0, 50, "FIRST"), 0);
});

test("converts override physical tickets back to the canonical remaining count", () => {
  assert.equal(remainingTicketsFromPhysicalTicket(50, 150, 50, "FIRST"), 101);
  assert.equal(remainingTicketsFromPhysicalTicket(50, 150, 100, "FIRST"), 51);
  assert.equal(remainingTicketsFromPhysicalTicket(1, 150, 150, "LAST"), 150);
  assert.equal(remainingTicketsFromPhysicalTicket(1, 150, 100, "LAST"), 100);
  assert.equal(remainingTicketsFromPhysicalTicket(50, 150, 49, "FIRST"), null);
});

test("switching sell direction preserves remaining inventory and updates the physical ticket", () => {
  const remainingAtStart = remainingTicketsAfterDirectionChange(50, 1, 50, "LAST");
  assert.equal(remainingAtStart, 50);
  assert.equal(getDisplayedTicketNumber(1, remainingAtStart!, 50, "LAST"), 50);

  const remainingAfterSales = remainingTicketsAfterDirectionChange(42, 1, 50, "LAST");
  assert.equal(remainingAfterSales, 42);
  assert.equal(getDisplayedTicketNumber(1, remainingAfterSales!, 50, "LAST"), 42);

  const switchedBack = remainingTicketsAfterDirectionChange(42, 1, 50, "FIRST");
  assert.equal(switchedBack, 42);
  assert.equal(getDisplayedTicketNumber(1, switchedBack!, 50, "FIRST"), 9);
});
