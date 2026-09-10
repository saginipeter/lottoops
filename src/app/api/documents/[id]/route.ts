import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canAccessReports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Document access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, storeId: session.storeId }, select: { url: true } });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.redirect(document.url);
}