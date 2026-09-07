import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { isStoreFeatureEnabled } from "@/lib/feature-flags";

export async function POST() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isStoreFeatureEnabled(session.storeId, "WHATSAPP_SUMMARIES"))) return NextResponse.json({ error: "WhatsApp summaries are disabled for this store." }, { status: 403 });
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.WHATSAPP_SUMMARY_RECIPIENT;
  if (!token || !phoneNumberId || !recipient) return NextResponse.json({ error: "WhatsApp delivery is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_SUMMARY_RECIPIENT." }, { status: 503 });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  try {
    const [store, shifts, lockedPacks, auditVariances] = await Promise.all([
      prisma.store.findUnique({ where: { id: session.storeId }, select: { name: true } }),
      prisma.shift.findMany({ where: { storeId: session.storeId, openedAt: { gte: today } }, select: { lines: { select: { ticketsSold: true, salesAmount: true } } } }),
      prisma.pack.count({ where: { storeId: session.storeId, sequenceLocked: true } }),
      prisma.inventoryAuditLine.count({ where: { audit: { storeId: session.storeId, endedAt: { gte: today } }, variance: { not: 0 } } }),
    ]);
    const tickets = shifts.reduce((sum: number, shift: { lines: Array<{ ticketsSold: number | null }> }) => sum + shift.lines.reduce((lineSum, line) => lineSum + Number(line.ticketsSold ?? 0), 0), 0);
    const sales = shifts.reduce((sum: number, shift: { lines: Array<{ salesAmount: unknown }> }) => sum + shift.lines.reduce((lineSum, line) => lineSum + Number(line.salesAmount ?? 0), 0), 0);
    const message = `${store?.name ?? "LottoOps store"} daily summary\nShifts: ${shifts.length}\nTickets sold: ${tickets}\nSales: $${sales.toFixed(2)}\nAudit variances: ${auditVariances}\nOpen sequence locks: ${lockedPacks}`;
    const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body: message } }) });
    if (!response.ok) { const detail = await response.text(); console.error("[WhatsApp summary]", detail); return NextResponse.json({ error: "WhatsApp rejected the summary delivery." }, { status: 502 }); }
    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("[POST /api/reports/whatsapp-summary]", error);
    return NextResponse.json({ error: "Unable to send WhatsApp summary." }, { status: 500 });
  }
}
