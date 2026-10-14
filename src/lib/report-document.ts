export type ReportValue = string | number | null | undefined;
export interface ReportDocument {
  title: string;
  subtitle?: string;
  paper?: "A4" | "receipt";
  metadata?: Array<{ label: string; value: ReportValue }>;
  sections: Array<{
    title: string;
    columns: string[];
    rows: ReportValue[][];
    totals?: ReportValue[];
  }>;
  notes?: string[];
}

export function escapeReportValue(value: ReportValue): string {
  return String(value ?? "Not recorded").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderReportDocument(report: ReportDocument): string {
  const escape = escapeReportValue;
  const cells = (values: ReportValue[], tag: "td" | "th") =>
    values.map((value) => `<${tag}>${escape(value)}</${tag}>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escape(report.title)}</title><style>
@page { size: ${report.paper === "receipt" ? "80mm auto" : "A4"}; margin: 12mm; }
* { box-sizing: border-box; } body { margin: 0; padding: 16px; color: #111; background: white; font: 12px Arial, sans-serif; }
main { max-width: ${report.paper === "receipt" ? "72mm" : "190mm"}; margin: auto; }
h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 15px; margin-top: 24px; break-after: avoid; }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } dt { font-weight: bold; } dd { margin: 3px 0; white-space: pre-wrap; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { border: 1px solid #aaa; padding: 6px; text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
thead { display: table-header-group; } tr { break-inside: avoid; } tfoot { font-weight: bold; } p { white-space: pre-wrap; overflow-wrap: anywhere; }
@media print { body { padding: 0; } }
</style></head><body><main><h1>${escape(report.title)}</h1>
${report.subtitle ? `<p>${escape(report.subtitle)}</p>` : ""}
<dl>${(report.metadata ?? []).map(({ label, value }) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
${report.sections.map((section) => `<section><h2>${escape(section.title)}</h2><table><thead><tr>${cells(section.columns, "th")}</tr></thead><tbody>${section.rows.length ? section.rows.map((row) => `<tr>${cells(row, "td")}</tr>`).join("") : `<tr><td colspan="${Math.max(1, section.columns.length)}">No records</td></tr>`}</tbody>${section.totals ? `<tfoot><tr>${cells(section.totals, "td")}</tr></tfoot>` : ""}</table></section>`).join("")}
${(report.notes ?? []).map((note) => `<p>${escape(note)}</p>`).join("")}
</main></body></html>`;
}
