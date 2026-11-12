"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { changedActivePackMetadata } from "@/lib/active-pack-metadata";

type Pack = {
  id: string;
  packNumber?: string | null;
  serialNumber: string;
  notes?: string | null;
  lotNumber?: string | null;
  activationNumber?: string | null;
  activationReceipt?: string | null;
  activationReceiptPhoto?: string | null;
  packImage?: string | null;
  game?: { name?: string; gameNumber?: string };
};

type FormValues = {
  notes: string;
  lotNumber: string;
  activationNumber: string;
  activationReceipt: string;
  activationReceiptPhoto: string;
  packImage: string;
  reason: string;
};

function fromPack(pack: Pack): FormValues {
  return {
    notes: pack.notes ?? "",
    lotNumber: pack.lotNumber ?? "",
    activationNumber: pack.activationNumber ?? "",
    activationReceipt: pack.activationReceipt ?? "",
    activationReceiptPhoto: pack.activationReceiptPhoto ?? "",
    packImage: pack.packImage ?? "",
    reason: "",
  };
}

function metadataValues(values: FormValues) {
  return {
    notes: values.notes,
    lotNumber: values.lotNumber,
    activationNumber: values.activationNumber,
    activationReceipt: values.activationReceipt,
    activationReceiptPhoto: values.activationReceiptPhoto,
    packImage: values.packImage,
  };
}

const fields: Array<{ key: keyof Omit<FormValues, "reason">; label: string; type?: string }> = [
  { key: "notes", label: "Notes" },
  { key: "lotNumber", label: "Lot number" },
  { key: "activationNumber", label: "Activation number" },
  { key: "activationReceipt", label: "Activation receipt link", type: "url" },
  { key: "activationReceiptPhoto", label: "Activation receipt photo link", type: "url" },
  { key: "packImage", label: "Pack image link", type: "url" },
];

export function ActivePackUpdateDialog({ pack, open, onOpenChange }: {
  pack: Pack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => pack ? fromPack(pack) : fromPack({ id: "", serialNumber: "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (pack) setValues(fromPack(pack));
    setError("");
  }, [pack]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pack || saving) return;
    setSaving(true); setError("");
    try {
      const metadata = changedActivePackMetadata(metadataValues(fromPack(pack)), metadataValues(values));
      if (Object.keys(metadata).length === 0) throw new Error("Change at least one pack metadata field before saving.");
      const response = await fetch(`/api/packs/${encodeURIComponent(pack.id)}/update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata, reason: values.reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to update this pack.");
      onOpenChange(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this pack.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Update This Pack</DialogTitle>
        <DialogDescription>
          Pack {pack?.packNumber ?? pack?.serialNumber ?? "—"} · Game {pack?.game?.gameNumber ?? "—"} — only approved descriptive metadata can change here. Ticket position, price, quantity, direction, and pack identity are protected.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(({ key, label, type }) => (
            <label key={key} className="space-y-1 text-sm font-medium">
              <span>{label}</span>
              <input type={type ?? "text"} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                className="min-h-10 w-full border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-sm font-medium">
          <span>Reason for update (required)</span>
          <textarea required minLength={6} maxLength={1000} value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))}
            className="min-h-20 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </label>
        <p className="text-xs text-text-secondary">Changes are logged field-by-field and create a manager Pack Update alert. Clearing a value will remove that metadata only; it will not alter ticket or financial history.</p>
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!pack || saving || values.reason.trim().length < 6}>{saving ? "Saving…" : "Save Pack Update"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
