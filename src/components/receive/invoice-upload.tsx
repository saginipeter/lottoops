"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  title?: string;
  previewAlt?: string;
  errorMessage?: string;
  compact?: boolean;
  onChange: (url: string) => void;
}

export function InvoiceUpload({
  value,
  title = "Upload Invoice Photo",
  previewAlt = "Uploaded image",
  errorMessage = "Failed to upload image.",
  compact = false,
  onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert("This image is larger than 10 MB. Please retake it or choose a smaller image.");
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      }

      if (typeof data.url !== "string") throw new Error("Upload completed without a file URL.");
      onChange(data.url);
    } catch (error) {
      console.error(error);
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "Image upload timed out. Check your connection and try again."
        : error instanceof Error && error.message
          ? error.message
          : errorMessage;
      alert(message);
    } finally {
      window.clearTimeout(timeout);
      setUploading(false);
    }
  }

  return (
    <div className="block">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
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
        accept="image/*"
        className="sr-only"
        disabled={uploading}
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          await handleFile(e.target.files[0]);
        }}
      />

      <div className={`flex ${compact ? "h-32" : "h-48"} flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 transition hover:bg-purple-100`}>
        {value ? (
          <div className="relative h-full w-full">
            <Image
              src={value}
              alt={previewAlt}
              width={640}
              height={360}
              unoptimized
              className="h-full w-full rounded-xl object-contain"
            />

            <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center text-sm text-white">
              {uploading ? "Uploading..." : "Click to replace image"}
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
              Take a live photo or upload an existing image
            </p>
          </>
        )}
      </div>

      <div className={`mt-3 flex flex-wrap gap-2 ${compact ? "[&>button]:min-h-9 [&>button]:px-2 [&>button]:text-xs" : "gap-3"}`}>
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
          Upload Existing Photo
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
