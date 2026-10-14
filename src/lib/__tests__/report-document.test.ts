import assert from "node:assert/strict";
import test from "node:test";
import { escapeReportValue, renderReportDocument, type ReportDocument } from "../report-document";

const report: ReportDocument = {
  title: "Shift sales & audit",
  metadata: [{ label: "Operator", value: 'A <script>alert("x")</script>' }],
  sections: [{
    title: "Ticket counts",
    columns: ["Pack", "Opening", "Closing", "Sales"],
    rows: [["<img src=x onerror=alert(1)>", 100, 0, "$100.00"]],
    totals: ["Total", 100, 0, "$100.00"],
  }],
  notes: ["Returns / voids: Not recorded"],
};

test("document rendering escapes all data fields rather than copying dashboard HTML", () => {
  const html = renderReportDocument({
    ...report,
    title: '<svg onload="attack()">',
    subtitle: "</p><script>attack()</script>",
    sections: [{
      title: "<script>title</script>",
      columns: ['<img src="x">'],
      rows: [["</td><script>row</script>"]],
      totals: ["<script>total</script>"],
    }],
    notes: ["<script>note</script>"],
  });
  assert.doesNotMatch(html, /<script|<img|<svg/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot;attack\(\)&quot;/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<button|<nav|<aside|<input|<iframe/);
});

test("report preserves zero values, totals and explicit missing data", () => {
  const html = renderReportDocument(report);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /<tfoot>/);
  assert.match(html, /Returns \/ voids: Not recorded/);
  assert.equal(escapeReportValue(null), "Not recorded");
  assert.equal(escapeReportValue(undefined), "Not recorded");
  assert.equal(escapeReportValue(0), "0");
});

test("print document uses independent A4 or receipt styling and repeatable table headers", () => {
  assert.match(renderReportDocument(report), /@page \{ size: A4;/);
  assert.match(renderReportDocument({ ...report, paper: "receipt" }), /size: 80mm auto/);
  assert.match(renderReportDocument(report), /table-header-group/);
  assert.match(renderReportDocument({ title: "Empty", sections: [{ title: "Packs", columns: ["Pack"], rows: [] }] }), /No records/);
});
