import { prisma } from "@/lib/prisma";

const INVENTORY_COST_RATE = 0.95;

export interface FinancialSummary {
  period: "daily" | "weekly";
  from: string;
  to: string;
  totals: { sales: number; cogs: number; net: number; tickets: number; shifts: number; lockedPacks: number; auditVariances: number };
  stores: Array<{ name: string; sales: number; cogs: number; net: number; tickets: number; shifts: number }>;
}

interface CommandOrganization {
  name: string;
  owner: { email: string };
  stores: Array<{ id: string; name: string }>;
}

function round(value: number) { return Math.round(value * 100) / 100; }

export async function buildCommandSummaries(period: "daily" | "weekly", now = new Date()): Promise<Array<{ recipient: string; organization: string; summary: FinancialSummary }>> {
  if (!prisma) throw new Error("Database unavailable");
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  if (period === "daily") start.setUTCDate(start.getUTCDate() - 1);
  else start.setUTCDate(start.getUTCDate() - 7);

  const organizations = await prisma.organization.findMany({
    where: { subscription: { status: { in: ["ACTIVE", "TRIALING"] }, plan: { key: "COMMAND" } } },
    select: { name: true, owner: { select: { email: true } }, stores: { select: { id: true, name: true } } },
  });

  return Promise.all((organizations as CommandOrganization[]).map(async (organization: CommandOrganization) => {
    const storeIds = organization.stores.map((store: { id: string }) => store.id);
    const [shifts, lockedPacks, auditVariances] = await Promise.all([
      prisma.shift.findMany({ where: { storeId: { in: storeIds }, status: "CLOSED", closedAt: { gte: start, lt: end } }, select: { store: { select: { name: true } }, lines: { select: { ticketsSold: true, salesAmount: true, pack: { select: { game: { select: { price: true } } } } } } } }),
      prisma.pack.count({ where: { storeId: { in: storeIds }, sequenceLocked: true } }),
      prisma.inventoryAuditLine.count({ where: { audit: { storeId: { in: storeIds }, endedAt: { gte: start, lt: end } }, variance: { not: 0 } } }),
    ]);

    const byStore = new Map<string, { sales: number; cogs: number; tickets: number; shifts: number }>();
    for (const shift of shifts) {
      const row = byStore.get(shift.store.name) ?? { sales: 0, cogs: 0, tickets: 0, shifts: 0 };
      row.shifts += 1;
      for (const line of shift.lines) {
        const tickets = Number(line.ticketsSold ?? 0);
        row.tickets += tickets;
        row.sales += Number(line.salesAmount ?? 0);
        row.cogs += tickets * Number(line.pack.game.price) * INVENTORY_COST_RATE;
      }
      byStore.set(shift.store.name, row);
    }
    const stores = Array.from(byStore.entries()).map(([name, row]) => ({ name, sales: round(row.sales), cogs: round(row.cogs), net: round(row.sales - row.cogs), tickets: row.tickets, shifts: row.shifts }));
    const sales = round(stores.reduce((sum, store) => sum + store.sales, 0));
    const cogs = round(stores.reduce((sum, store) => sum + store.cogs, 0));
    return { recipient: organization.owner.email, organization: organization.name, summary: { period, from: start.toISOString(), to: end.toISOString(), totals: { sales, cogs, net: round(sales - cogs), tickets: stores.reduce((sum, store) => sum + store.tickets, 0), shifts: stores.reduce((sum, store) => sum + store.shifts, 0), lockedPacks, auditVariances }, stores } };
  }));
}

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

export function renderFinancialSummaryEmail(organization: string, summary: FinancialSummary) {
  const label = summary.period === "daily" ? "Daily" : "Weekly";
  const rows = summary.stores.map((store) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(store.name)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">$${store.sales.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${store.tickets}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${store.shifts}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;color:#17233f;max-width:760px"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#087da8">LOTTOOPS · COMMAND</p><h1>${label} financial summary</h1><p>${escapeHtml(organization)} · ${new Date(summary.from).toLocaleDateString()} – ${new Date(summary.to).toLocaleDateString()}</p><div style="display:flex;gap:12px;margin:24px 0"><strong>Sales $${summary.totals.sales.toFixed(2)}</strong><strong>COGS $${summary.totals.cogs.toFixed(2)}</strong><strong>Net $${summary.totals.net.toFixed(2)}</strong><strong>Tickets ${summary.totals.tickets}</strong></div><table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Store</th><th style="padding:8px;text-align:right">Sales</th><th style="padding:8px;text-align:right">Tickets</th><th style="padding:8px;text-align:right">Shifts</th></tr></thead><tbody>${rows || `<tr><td colspan="4" style="padding:12px">No closed shifts in this period.</td></tr>`}</tbody></table><p style="margin-top:24px;font-size:13px;color:#64748b">Locked packs: ${summary.totals.lockedPacks} · Audit variances: ${summary.totals.auditVariances}</p></div>`;
}

export async function sendFinancialSummaryEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email delivery is not configured. Set RESEND_API_KEY and REPORT_EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) { console.error("[Resend financial summary]", await response.text()); throw new Error("Email provider rejected the financial summary."); }
}
