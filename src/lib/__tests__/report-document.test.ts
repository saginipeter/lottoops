import assert from "node:assert/strict";
import test from "node:test";
import { renderReportDocument } from "../report-document";

test("report documents include only supplied data and print-specific structure", () => {
  const html = renderReportDocument({
    title: "Receiving Shipment",
    metadata: [{ label: "Invoice", value: "INV-123" }],
    sections: [{ title: "Packs", columns: ["Pack", "Tickets"], rows: [["001", 50]] }],
    totals: [{ label: "Received packs", value: 1 }],
  });
  assert.match(html, /INV-123/);
  assert.match(html, /<td>001<\/td><td>50<\/td>/);
  assert.match(html, /size: A4/);
  assert.match(html, /table-header-group/);
  assert.doesNotMatch(html, /<button|<nav|<script|position:\s*fixed/);
});

test("all supplied document text is escaped, including hostile markup", () => {
  const attack = '<img src=x onerror="alert(1)">&\'';
  const html = renderReportDocument({
    title: attack,
    subtitle: attack,
    metadata: [{ label: attack, value: attack }],
    sections: [{ title: attack, columns: [attack], rows: [[attack]] }],
    totals: [{ label: attack, value: attack }],
  });
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;&#39;/);
  assert.match(html, /default-src 'none'/);
});

test("empty and missing data remains explicit without inventing totals", () => {
  const html = renderReportDocument({
    title: "Shift Audit",
    metadata: [{ label: "Card totals", value: null }, { label: "Cash", value: 0 }],
    sections: [{ title: "Audit", columns: ["Pack"], rows: [] }],
  });
  assert.match(html, /<dd>Not recorded<\/dd>/);
  assert.match(html, /<dd>0<\/dd>/);
  assert.match(html, /No records\./);
});
