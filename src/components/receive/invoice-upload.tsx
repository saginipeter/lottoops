"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useUploadThing } from "@/utils/uploadthing";

interface Props {
  value?: string;
  onChange: (url: string) => void;
}

export function InvoiceUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const { startUpload } = useUploadThing("invoiceUploader");

  async function handleFile(file: File) {
    setUploading(true);

    try {
      const res = await startUpload([file]);

      if (res?.[0]) {
        onChange(res[0].serverData.url)
       
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label className="block cursor-pointer">


        <input
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

        <div className="flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 transition hover:bg-purple-100">


            {value ? (
                    <div className="relative h-full w-full">

                        <Image
                        src={value}
                        alt="Invoice"
                        fill
                        className="rounded-xl object-contain"
                        />

                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center text-sm text-white">
                        Click to replace image
                        </div>

                    </div>
                    ) : (
            <>
              <Camera
                size={40}
                className="mb-3 text-purple-600"
              />

              <p className="font-medium text-purple-700">
                {uploading
                  ? "Uploading..."
                  : "Upload Invoice Photo"}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Drag, click or take a photo
              </p>
            </>
          )}

        </div>

      </label>
    </>
  );
}