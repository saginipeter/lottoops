import type { ReportDocument } from "./report-document";

export async function resolveReportActionDocument({
  report,
  loadDocument,
  refreshOnNewAction,
  action,
  preview,
  loadedSnapshot,
}: {
  report?: ReportDocument;
  loadDocument?: () => Promise<ReportDocument>;
  refreshOnNewAction: boolean;
  action: "view" | "print";
  preview: ReportDocument | null;
  loadedSnapshot: ReportDocument | null;
}): Promise<ReportDocument> {
  if (report) return report;
  if (refreshOnNewAction && loadDocument) return loadDocument();
  if (action === "print" && preview && loadedSnapshot) return loadedSnapshot;
  if (loadedSnapshot) return loadedSnapshot;
  if (loadDocument) return loadDocument();
  throw new Error("Report data is unavailable.");
}
