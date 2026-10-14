import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";

/**
 * POST /api/tickets/return-requests/[id]/deny
 * Deny a review without undoing the return, or deny a legacy pending request.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isManagerOrAbove(session)) {
    return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  const { id } = await params;

  try {
    const rows = (
      session.role === "OWNER"
        ? ((await prisma.$queryRawUnsafe(
            `
            SELECT r.id FROM ticket_return_requests r
            JOIN stores ON stores.id = r.store_id
            WHERE r.id = $1 AND r.status IN ('PENDING', 'RETURNED_PENDING_REVIEW') AND stores."ownerUserId" = $2
            LIMIT 1
            `,
            id,
            session.userId
          )) as { id: string }[])
        : ((await prisma.$queryRawUnsafe(
            `
            SELECT id FROM ticket_return_requests
            WHERE id = $1 AND store_id = $2 AND status IN ('PENDING', 'RETURNED_PENDING_REVIEW')
            LIMIT 1
            `,
            id,
            session.storeId
          )) as { id: string }[])
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Return request not found or already resolved." }, { status: 404 });
    }

    const resolved = await prisma.$executeRawUnsafe(
      `
      UPDATE ticket_return_requests
      SET status = CASE WHEN status = 'RETURNED_PENDING_REVIEW' THEN 'RETURN_REVIEW_DENIED' ELSE 'DENIED' END,
        resolved_at = NOW(), resolved_by_id = $2, resolved_by_name = $3
      WHERE id = $1 AND status IN ('PENDING', 'RETURNED_PENDING_REVIEW')
      `,
      id,
      session.userId,
      session.name
    );
    if (resolved !== 1) {
      return NextResponse.json({ error: "Return request already resolved." }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/tickets/return-requests/[id]/deny]", error);
    return NextResponse.json({ error: "Unable to deny return request." }, { status: 500 });
  }
}
