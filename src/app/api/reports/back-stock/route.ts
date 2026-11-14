import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canAccessReports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Reports access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const summary = await prisma.pack.aggregate({
      where: { storeId: session.storeId, status: "BACK_STOCK" },
      _count: { _all: true },
      _sum: { retailValue: true },
    });
    const totalRetailValue = Number(summary._sum.retailValue ?? 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalPackQuantity: summary._count._all,
      totalRetailValue: roundCurrency(totalRetailValue),
      costPayout95: roundCurrency(totalRetailValue * 0.95),
    });
  } catch (error) {
    console.error("[GET /api/reports/back-stock]", error);
    return NextResponse.json({ error: "Unable to load Back Stock totals." }, { status: 500 });
  }
}
