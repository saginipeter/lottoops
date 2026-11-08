import assert from "node:assert/strict";
import test from "node:test";
import { resolveReportActionDocument } from "../report-action-document";
import type { ReportDocument } from "../report-document";

const document = (title: string): ReportDocument => ({ title, sections: [] });

test("live audit actions refresh the server snapshot even when a preview is already open", async () => {
  const preview = document("Preview snapshot");
  const latest = document("Latest snapshot");
  let requests = 0;
  const loadDocument = async () => {
    requests += 1;
    return requests === 1 ? preview : latest;
  };

  const viewed = await resolveReportActionDocument({
    loadDocument,
    refreshOnNewAction: true,
    action: "view",
    preview: null,
    loadedSnapshot: null,
  });
  assert.equal(viewed.title, "Preview snapshot");

  const printed = await resolveReportActionDocument({
    loadDocument,
    refreshOnNewAction: true,
    action: "print",
    preview: viewed,
    loadedSnapshot: viewed,
  });
  assert.equal(printed.title, "Latest snapshot");
  assert.equal(requests, 2);
});

test("ordinary report print uses the exact data-only document already previewed", async () => {
  const preview = document("Same report snapshot");
  let requests = 0;
  const printed = await resolveReportActionDocument({
    loadDocument: async () => { requests += 1; return document("Unexpected refresh"); },
    refreshOnNewAction: false,
    action: "print",
    preview,
    loadedSnapshot: preview,
  });
  assert.equal(printed, preview);
  assert.equal(requests, 0);
});
