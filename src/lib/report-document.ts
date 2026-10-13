export interface ReportDocument {
  title: string;
  subtitle?: string;
  metadata?: Array<{ label: string; value: string | number | null }>;
  sections: Array<{
    title: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
  }>;
  totals?: Array<{ label: string; value: string | number | null }>;
}

function escapeHtml(value: string | number | null) {
  return String(value ?? "Not recorded").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function renderReportDocument(report: ReportDocument): string {
  const fields = (items: ReportDocument["metadata"]) => (items ?? []).map(
    ({ label, value }) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  ).join("");
  const sections = report.sections.map((section) => `
    <section><h2>${escapeHtml(section.title)}</h2>
    <table><thead><tr>${section.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr></thead>
    <tbody>${section.rows.length ? section.rows.map((row) => `<tr>${section.columns.map((_, index) => `<td>${escapeHtml(row[index] ?? null)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${section.columns.length}">No records.</td></tr>`}</tbody></table></section>
  `).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>${escapeHtml(report.title)}</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: white; color: #111827; font: 12px/1.5 Arial, sans-serif; }
    main { max-width: 210mm; margin: auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 24px 0 8px; break-after: avoid; }
    p { margin: 0 0 16px; }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    dt { font-weight: bold; } dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
    th { background: #f1f5f9; } thead { display: table-header-group; }
    tr, dl > div { break-inside: avoid; }
    .totals { border-top: 2px solid #111827; padding-top: 12px; margin-top: 24px; }
    @media print { main { max-width: none; padding: 0; } }
    </style></head><body><main><h1>${escapeHtml(report.title)}</h1>
    ${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ""}
    <dl>${fields(report.metadata)}</dl>${sections}
    ${report.totals?.length ? `<dl class="totals">${fields(report.totals)}</dl>` : ""}
    </main></body></html>`;
}
