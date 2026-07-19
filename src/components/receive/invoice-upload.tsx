"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  title?: string;
  previewAlt?: string;
  errorMessage?: string;
  onChange: (url: string) => void;
}

export function InvoiceUpload({
  value,
  title = "Upload Invoice Photo",
  previewAlt = "Uploaded image",
  errorMessage = "Failed to upload image.",
  onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      console.log("Blob upload:", data);

      onChange(data.url);
    } catch (error) {
      console.error(error);
      alert(errorMessage);
    } finally {
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
        hidden
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
        hidden
        disabled={uploading}
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          await handleFile(e.target.files[0]);
        }}
      />

      <div className="flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 transition hover:bg-purple-100">
        {value ? (
          <div className="relative h-full w-full">
            <img
              src={value}
              alt={previewAlt}
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
          Upload Existing Photo
        </Button>
      </div>
    </div>
  );
}