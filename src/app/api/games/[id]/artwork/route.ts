import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canManageGames } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_ARTWORK_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type DetectedImage = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length >= 8 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!canManageGames(session)) {
      return NextResponse.json({ error: "You don't have permission to replace game artwork." }, { status: 403 });
    }
    if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "File storage is not configured. Set BLOB_READ_WRITE_TOKEN in the deployment environment." },
        { status: 503 },
      );
    }

    const { id } = await params;
    const game = await prisma.game.findFirst({
      where: { id: String(id), storeId: session.storeId },
      select: { id: true, name: true },
    });
    if (!game) return NextResponse.json({ error: "Game not found for this store." }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No artwork file uploaded." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Artwork must be a JPEG, PNG, or WebP image." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_ARTWORK_SIZE) {
      return NextResponse.json({ error: "Artwork must be between 1 byte and 10 MB." }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected || !ALLOWED_TYPES.has(detected.contentType)) {
      return NextResponse.json({ error: "The uploaded file is not a valid JPEG, PNG, or WebP image." }, { status: 415 });
    }

    const pathname = `stores/${session.storeId}/games/${game.id}/artwork/${crypto.randomUUID()}.${detected.extension}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: detected.contentType,
    });

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { imageUrl: blob.url },
      select: { id: true, imageUrl: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      game: updated,
      message: `${game.name} artwork replaced successfully.`,
    });
  } catch (error) {
    console.error("[POST /api/games/:id/artwork]", error);
    const message = error instanceof Error ? error.message : "";
    const storageError = /blob|token|storage|upload/i.test(message);
    return NextResponse.json(
      {
        error: storageError
          ? "Image storage rejected the artwork. Verify the production BLOB_READ_WRITE_TOKEN and Vercel Blob configuration."
          : "Artwork upload failed while saving the game.",
      },
      { status: storageError ? 502 : 500 },
    );
  }
}
