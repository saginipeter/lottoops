import { NextRequest, NextResponse } from "next/server";
import { buildCommandSummaries, renderFinancialSummaryEmail, sendFinancialSummaryEmail } from "@/lib/financial-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const period = request.nextUrl.searchParams.get("period") === "weekly" ? "weekly" : "daily";
  try {
    const summaries = await buildCommandSummaries(period);
    const results: Array<{ recipient: string; sent: boolean; error?: string }> = [];
    for (const item of summaries) {
      try {
        await sendFinancialSummaryEmail(item.recipient, `LottoOps ${period} financial summary · ${item.organization}`, renderFinancialSummaryEmail(item.organization, item.summary));
        results.push({ recipient: item.recipient, sent: true });
      } catch (error) {
        results.push({ recipient: item.recipient, sent: false, error: error instanceof Error ? error.message : "Delivery failed" });
      }
    }
    return NextResponse.json({ period, organizations: summaries.length, results });
  } catch (error) {
    console.error("[GET /api/cron/financial-summary]", error);
    return NextResponse.json({ error: "Unable to generate financial summaries." }, { status: 500 });
  }
}
