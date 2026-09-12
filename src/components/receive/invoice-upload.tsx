"use client";

import { Camera, FileText, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  title?: string;
  previewAlt?: string;
  errorMessage?: string;
  allowPdf?: boolean;
  onChange: (url: string) => void;
}

export function InvoiceUpload({
  value,
  title = "Upload Invoice Photo",
  previewAlt = "Uploaded image",
  errorMessage = "Failed to upload image.",
  allowPdf = false,
  onChange,
}: Props) {
  const UPLOAD_TIMEOUT_MS = 45_000;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const IMAGE_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ] as const;
  const ALLOWED_FILE_TYPES = new Set([
    ...IMAGE_FILE_TYPES,
    ...(allowPdf ? ["application/pdf"] : []),
  ]);
  const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
  const ACCEPTED_DOCUMENT_TYPES = `${ACCEPTED_IMAGE_TYPES},.pdf,application/pdf`;
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isPdf = value?.toLowerCase().includes(".pdf") ?? false;

  function resetInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (uploading) return;
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      alert(
        allowPdf
          ? "Only JPEG, PNG, WebP, HEIC, HEIF, and PDF files are allowed."
          : "Only JPEG, PNG, WebP, HEIC, and HEIF images are allowed."
      );
      resetInputs();
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      alert(`${allowPdf ? "Files" : "Images"} must be between 1 byte and 10 MB.`);
      resetInputs();
      return;
    }

    setUploading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const raw = await response.text();
      let data: { error?: string; url?: string } | null = null;
      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string; url?: string };
        } catch {
          data = null;
        }
      }
      if (!response.ok || typeof data?.url !== "string") {
        const fallbackMessage = response.status >= 500
          ? "Upload service is unavailable right now. Please try again."
          : `Upload failed (${response.status}). Please try again.`;
        throw new Error(data?.error || raw.trim() || fallbackMessage);
      }
      onChange(data.url);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof DOMException && error.name === "AbortError"
          ? "Upload timed out. Please try again."
          : error instanceof Error && error.message
            ? error.message
            : errorMessage
      );
    } finally {
      window.clearTimeout(timeout);
      resetInputs();
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        capture="environment"
        className="sr-only"
        disabled={uploading}
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          await handleFile(e.target.files[0]);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={allowPdf ? ACCEPTED_DOCUMENT_TYPES : ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        disabled={uploading}
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          await handleFile(e.target.files[0]);
        }}
      />

      <div className="flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 transition hover:bg-purple-100">
        {value ? (
          <div className="relative h-full w-full">
            {isPdf ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 text-center">
                <FileText size={40} className="text-purple-600" />
                <p className="text-sm font-medium text-purple-700">PDF uploaded</p>
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-purple-700 underline"
                >
                  Open uploaded PDF
                </a>
              </div>
            ) : (
              <Image
                src={value}
                alt={previewAlt}
                width={640}
                height={360}
                unoptimized
                className="h-full w-full rounded-xl object-contain"
              />
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center text-sm text-white">
              {uploading ? "Uploading..." : `Click to replace ${isPdf ? "file" : "image"}`}
            </div>
          </div>
        ) : (
          <>
            <Camera
              size={40}
              className="mb-3 text-purple-600"
            />

            <p className="font-medium text-purple-700">
              {uploading ? "Uploading..." : title}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {allowPdf
                ? "Take a live photo or upload an existing image or PDF"
                : "Take a live photo or upload an existing image"}
            </p>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take Live Photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {allowPdf ? "Upload Existing File" : "Upload Existing Photo"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => onChange("")}
            className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Trash2 size={15} />
            Remove Photo
          </Button>
        )}
      </div>
    </div>
  );
}
