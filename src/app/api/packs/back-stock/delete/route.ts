import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can permanently delete records." },
      { status: 403 }
    );
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { packId } = await req.json();
  if (!packId) return NextResponse.json({ error: "packId is required." }, { status: 400 });

  await prisma.pack.delete({ where: { id: packId } });

  return NextResponse.json({ success: true });
}