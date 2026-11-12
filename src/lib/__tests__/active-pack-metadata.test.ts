import assert from "node:assert/strict";
import test from "node:test";
import { changedActivePackMetadata, type ActivePackMetadataValues } from "../active-pack-metadata";

const metadata = (overrides: Partial<ActivePackMetadataValues> = {}): ActivePackMetadataValues => ({
  notes: "Original notes",
  lotNumber: "LOT-A",
  activationNumber: "ACT-1",
  activationReceipt: "",
  activationReceiptPhoto: "",
  packImage: "",
  ...overrides,
});

test("stale pack metadata forms send only changed fields and preserve concurrent edits to other fields", () => {
  const openedSnapshot = metadata();
  const managerAForm = metadata({ lotNumber: "LOT-B" });
  const managerAPatch = changedActivePackMetadata(openedSnapshot, managerAForm);
  assert.deepEqual(managerAPatch, { lotNumber: "LOT-B" });

  const persistedAfterManagerA = { ...openedSnapshot, ...managerAPatch };
  const managerBStaleForm = metadata({ notes: "Verified invoice" });
  const managerBPatch = changedActivePackMetadata(openedSnapshot, managerBStaleForm);
  assert.deepEqual(managerBPatch, { notes: "Verified invoice" });

  const persistedAfterManagerB = { ...persistedAfterManagerA, ...managerBPatch };
  assert.equal(persistedAfterManagerB.lotNumber, "LOT-B");
  assert.equal(persistedAfterManagerB.notes, "Verified invoice");
});
