import assert from "node:assert/strict";
import test from "node:test";
import { isOpeningAuditComplete } from "../ticket-tracking-eligibility";

test("opening audit is eligible only while open and after every active display pack is physically recorded", () => {
  const lines = [
    { packId: "pack-1", beginningPhysicalTicket: 50 },
    { packId: "pack-2", beginningPhysicalTicket: 40 },
    { packId: "backstock", beginningPhysicalTicket: null },
  ];
  assert.equal(isOpeningAuditComplete("OPEN", lines, ["pack-1", "pack-2"]), true);
  assert.equal(isOpeningAuditComplete("OPEN", lines, ["pack-1", "pack-2", "pack-3"]), false);
  assert.equal(isOpeningAuditComplete("OPEN", [{ ...lines[0] }, { ...lines[1], beginningPhysicalTicket: null }], ["pack-1", "pack-2"]), false);
  assert.equal(isOpeningAuditComplete("COMPLETED", lines, ["pack-1", "pack-2"]), false);
  assert.equal(isOpeningAuditComplete(null, lines, ["pack-1", "pack-2"]), false);
});
