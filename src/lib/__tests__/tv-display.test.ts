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
import { parseTvScreenNumber, splitTvScreens, TV_SCREEN_CAPACITY, TV_SCREEN_ROTATION_SECONDS } from "@/lib/tv-screens";
import { remainingTicketsAfterDirectionChange, remainingTicketsFromPhysicalTicket } from "@/lib/core-validation";

test("TV slot HUDs show current and next ticket numbers in preview and kiosk modes", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const kioskMode of [false, true]) {
    const slots = (["FIRST", "LAST"] as const).map((sellDirection, index) => ({
      id: `slot-${index}`, packId: `pack-${index}`, gameId: `game-${index}`, slotNumber: String(index + 1),
      gameName: "Test game", gameNumber: "1234", ticketPrice: 1, sellDirection,
      firstTicket: 1, currentTicket: index === 0 ? 12 : 1, nextTicket: index === 0 ? 13 : 0,
      remaining: index === 0 ? 39 : 1, sold: index === 0 ? 11 : 49, quantity: 50,
    }));
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, {
      value: router,
    }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 30 })));
    assert.equal((html.match(/>CURRENT TICKET</g) ?? []).length, 2);
    assert.equal((html.match(/>NEXT TICKET</g) ?? []).length, 2);
    assert.equal((html.match(/>12</g) ?? []).length, 1);
    assert.match(html, />13</);
    assert.match(html, />—</);
    assert.equal((html.match(/class="tv-ticket-face"/g) ?? []).length, 4);
    assert.equal((html.match(/class="tv-ticket-number"/g) ?? []).length, 4);
    assert.match(html, /tv-ticket-badge-current/);
    assert.match(html, /tv-ticket-badge-next/);
    assert.equal((html.match(/tv-ticket-badge-current tv-ticket-badge-next/g) ?? []).length, 0);
    assert.match(html, /tv-card-meta/);
    assert.match(html, /tv-price-badge/);
    assert.match(html, /tv-price-value/);
    assert.match(html, /tv-display-badge/);
    assert.match(html, /tv-display-number/);
    assert.match(html, />\$1</);
    assert.match(html, /\.tv-price-badge \{ align-items:flex-start; border-color:#fff; border-radius:3px; background:#fff; color:#050505;/);
    assert.match(html, /\.tv-display-badge \{ align-items:flex-end; border-color:#fff; border-radius:3px; background:#fff; color:#050505;/);
    assert.match(html, /\.tv-ticket-face \{ position:relative; display:grid; width:100%; height:100%; place-items:center; box-sizing:border-box; border:min\(1\.5cqi,4\.2px\) solid #fff; border-radius:50%; background:#fff;/);
    assert.doesNotMatch(html, /border:min\(1\.5cqi,4\.2px\) solid #100d06/);
    assert.match(html, /\.tv-artwork-crop \{ position:absolute; inset:-18% 0 0;/);
    assert.match(html, /object-position:center bottom/);
    assert.match(html, /background:linear-gradient\(135deg,#ff9a9a/);
    assert.match(html, /\.tv-ticket-badge-current \{ width:43%;/);
    assert.match(html, /\.tv-ticket-badge-next \{ width:37%;/);
    assert.match(html, /\.tv-ticket-circle \{ position:relative; display:grid; width:80%;/);
    assert.match(html, /\.tv-ticket-badge-next \.tv-ticket-circle \{ width:72%;/);
    assert.doesNotMatch(html, /ticket-indicator-reference\.jpg/);
    assert.match(html, /data-live-status="live"/);
    assert.match(html, /@keyframes tv-artwork-drift/);
    assert.match(html, /@keyframes tv-artwork-shine/);
    assert.match(html, /@keyframes tv-sun-orbit/);
    assert.match(html, /@keyframes tv-ticket-change/);
    assert.match(html, /@keyframes tv-screen-enter/);
    assert.equal(TV_SCREEN_ROTATION_SECONDS, 30);
    assert.match(html, /prefers-reduced-motion:no-preference/);
  }
});

test("TV screens show at most 40 real entries in a 10-column 4-row grid", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const kioskMode of [false, true]) {
    for (const count of [0, 1, 14, 15, 16, 20, 30, 31, 40, 41, 80, 81]) {
      const slots = Array.from({ length: count }, (_, index) => ({
        id: `slot-${index}`, packId: `pack-${index}`, gameId: `game-${index}`, slotNumber: String(index + 1),
        gameName: `Test game ${index + 1}`, gameNumber: "1234", ticketPrice: 1,
        gameImage: `/game-${index}.png`,
        sellDirection: "FIRST" as const, firstTicket: 1, currentTicket: 12,
        nextTicket: 13, remaining: 38, sold: 12, quantity: 50,
      }));
      const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, {
        value: router,
      }, createElement(TvDisplayBoard, { slots, kioskMode, refreshSeconds: 30 })));
      const visibleCount = Math.min(count, TV_SCREEN_CAPACITY);
      assert.equal((html.match(/<article /g) ?? []).length, visibleCount);
      if (count === 0) {
        assert.match(html, /No games on display/);
      } else {
        assert.match(html, /tv-board-stack/);
        assert.match(html, new RegExp(`Test game ${visibleCount} artwork`));
        assert.match(html, /grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
        assert.match(html, /grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
        assert.doesNotMatch(html, /width:8cm|height:10cm|flex:0 0 8cm/);
        assert.equal((html.match(/class="tv-jackpot-board tv-jackpot-board-artwork"/g) ?? []).length, visibleCount);
      }
      if (count > TV_SCREEN_CAPACITY) assert.match(html, /aria-label="Next screen"/);
    }
  }
});

test("screen partitioning includes each entry once, in natural display order, without mutating inventory", () => {
  assert.equal(TV_SCREEN_CAPACITY, 40);
  for (const count of [0, 1, 39, 40, 41, 80, 81, 125]) {
    const slots = Array.from({ length: count }, (_, index) => ({ id: `display-${index}`, slotNumber: String(index + 1) })).reverse();
    const original = slots.map(slot => slot.id);
    const screens = splitTvScreens(slots);
    assert.equal(screens.length, Math.max(1, Math.ceil(count / 40)));
    assert.ok(screens.every(screen => screen.length <= 40));
    assert.equal(screens.flat().length, count);
    assert.equal(new Set(screens.flat().map(slot => slot.id)).size, count);
    assert.deepEqual(screens.flat().map(slot => Number(slot.slotNumber)), Array.from({ length: count }, (_, index) => index + 1));
    assert.deepEqual(slots.map(slot => slot.id), original);
  }
  assert.deepEqual(splitTvScreens([{ slotNumber: "40" }, { slotNumber: "02" }, { slotNumber: "9" }])[0].map(slot => slot.slotNumber), ["02", "9", "40"]);
});

test("screen selection rejects invalid values but does not redirect a fixed TV to another screen", () => {
  for (const value of [undefined, null, "", "0", "-1", "2.5", "1e3", "abc", 0, -1, 1.5, Infinity, NaN, 10001, {}, [2]]) {
    assert.equal(parseTvScreenNumber(value), 1);
  }
  for (const value of [1, 2, 10000, "1", "2", "10000"]) assert.equal(parseTvScreenNumber(value), Number(value));
});

test("screen links preserve kiosk access and removed overflow entries do not duplicate Screen 1", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  const slots = Array.from({ length: 81 }, (_, index) => ({
    id: `slot-${index}`, packId: `pack-${index}`, gameId: `game-${index}`, slotNumber: String(index + 1),
    gameName: `Game ${index + 1}`, gameNumber: "1234", ticketPrice: 1,
    sellDirection: "FIRST" as const, firstTicket: 1, currentTicket: 1,
    nextTicket: 2, remaining: 50, sold: 0, quantity: 50,
  }));
  const render = (screenNumber: number, entries = slots) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
    createElement(TvDisplayBoard, { slots: entries, kioskMode: true, refreshSeconds: 15, screenNumber, kioskToken: "signed-token" })));
  const second = render(2);
  assert.equal((second.match(/<article /g) ?? []).length, 40);
  assert.match(second, /data-display-id="slot-40"/);
  assert.match(second, /data-display-id="slot-79"/);
  assert.doesNotMatch(second, /data-display-id="slot-0"/);
  assert.match(second, /screen=3&amp;interval=15&amp;token=signed-token/);
  assert.match(second, /screen=1&amp;interval=15&amp;token=signed-token/);
  assert.equal((render(3).match(/<article /g) ?? []).length, 1);
  const empty = render(2, slots.slice(0, 40));
  assert.equal((empty.match(/<article /g) ?? []).length, 0);
  assert.match(empty, /No games on Screen 2/);
});

test("ticket UI follows confirmed inventory snapshots in both sell directions", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const direction of ["FIRST", "LAST"] as const) {
    for (const remaining of [150, 130, 129, 2, 1, 0]) {
      const currentTicket = getDisplayedTicketNumber(1, remaining, 150, direction);
      const nextTicket = getNextDisplayedTicket(1, remaining, 150, direction);
      const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
        createElement(TvDisplayBoard, { kioskMode: true, refreshSeconds: 15, slots: [{
          id: "display", packId: `pack-${direction}`, gameId: "game", slotNumber: "1",
          gameName: "Inventory snapshot", gameNumber: "1234", ticketPrice: 5,
          sellDirection: direction, firstTicket: 1, currentTicket, nextTicket, remaining,
          sold: 150 - remaining, quantity: 150,
        }] })));
      assert.ok(html.includes(`aria-label="CURRENT TICKET: ${remaining > 0 ? currentTicket : "unavailable"}"`));
      assert.ok(html.includes(`aria-label="NEXT TICKET: ${remaining > 1 ? nextTicket : "unavailable"}"`));
    }
  }
});

test("unavailable ticket data is never rendered as a fabricated number", () => {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, async prefetch() {} };
  for (const invalid of [NaN, Infinity, -1, 0, 1.5]) {
    const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router },
      createElement(TvDisplayBoard, { kioskMode: true, refreshSeconds: 15, slots: [{
        id: "display", packId: "pack", gameId: "game", slotNumber: "1",
        gameName: "Missing values", gameNumber: "1234", ticketPrice: 1,
        sellDirection: "FIRST", firstTicket: 1, currentTicket: invalid, nextTicket: invalid,
        remaining: 20, sold: 0, quantity: 20,
      }] })));
    assert.equal((html.match(/>—</g) ?? []).length, 2);
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
