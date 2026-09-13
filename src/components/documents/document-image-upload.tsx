"use client";

import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { InvoiceUpload } from "@/components/receive/invoice-upload";

export function DocumentImageUpload() {
  const [uploadedUrl, setUploadedUrl] = useState("");

  function handleUpload(url: string) {
    setUploadedUrl(url);
    window.dispatchEvent(new Event("lottoops:document-uploaded"));
  }

  return (
    <section className="border-b border-border pb-4">
      <div className="mb-3 flex items-start gap-2">
        <Upload size={18} className="mt-0.5 text-accent" />
        <div>
          <h2 className="text-base font-semibold text-text">Add Document Image</h2>
          <p className="mt-1 text-sm text-text-secondary">Upload an invoice, receipt, or other store document image.</p>
        </div>
      </div>
      <InvoiceUpload
        value={uploadedUrl}
        title="Upload Document Image"
        previewAlt="Uploaded document image"
        errorMessage="Document image could not be uploaded."
        onChange={handleUpload}
      />
      {uploadedUrl && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-success-soft-text">
          <CheckCircle2 size={16} /> Document image uploaded and added to the list.
        </p>
      )}
    </section>
  );
}
