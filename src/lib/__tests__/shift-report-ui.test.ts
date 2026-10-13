import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShiftPos } from "../../components/shifts/shift-pos";

const props = {
  shift: null, terminalId: "T1", activeDisplayPackCount: 0, shiftEvents: [],
  participants: [], employeeName: "Employee", storeName: "Store",
};

test("the actual completed-shift UI passes the archived shift ID to report actions", () => {
  const html = renderToStaticMarkup(createElement(ShiftPos, {
    ...props,
    recentClosedShift: {
      id: "archived-shift", openedAt: "2026-10-13T08:00:00Z",
      closedAt: "2026-10-13T16:00:00Z", openedBy: { name: "Opening Operator" },
      closedBy: { name: "Closing Operator" },
    },
  }));
  assert.match(html, /Last handover/);
  assert.match(html, /Opening Operator/);
  assert.match(html, /Closing Operator/);
  assert.match(html, /Loading completed shift report/);
  assert.doesNotMatch(html, /Shift report ID: Not recorded/);
});

test("clocked-out UI without an archived shift does not display archive report actions", () => {
  const html = renderToStaticMarkup(createElement(ShiftPos, props));
  assert.doesNotMatch(html, /Last handover|Loading completed shift report/);
});
