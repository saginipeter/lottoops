import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const blob = await put(
      `invoices/${Date.now()}-${file.name}`,
      file,
      {
        access: "private",
        addRandomSuffix: true,
      }
    );

    return NextResponse.json({
      success: true,
      url: blob.url,
    });
  } catch (error) {
    console.error("Blob upload error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
      },
      {
        status: 500,
      }
    );
  }
}