export interface ShiftSessionSaleRow {
  shiftId: string;
  sessionId: string | null;
  employeeId: string | null;
  employeeName: string | null;
  terminalId: string | null;
  signedInAt: Date | string | null;
  endedAt: Date | string | null;
  packId: string;
  pack: string;
  game: string;
  display: string | null;
  tickets: number | string;
  sales: number | string | null;
  firstSaleAt: Date | string | null;
  lastSaleAt: Date | string | null;
  hasEstimatedPrice: boolean;
}

export interface OperatorSessionSales {
  shiftId: string;
  sessionId: string | null;
  employeeId: string | null;
  employeeName: string;
  terminalId: string | null;
  signedInAt: Date | string | null;
  endedAt: Date | string | null;
  legacyAttribution: boolean;
  tickets: number;
  grossSales: number;
  hasEstimatedPrice: boolean;
  packs: Array<{
    packId: string;
    pack: string;
    game: string;
    display: string | null;
    tickets: number;
    grossSales: number;
    firstSaleAt: Date | string | null;
    lastSaleAt: Date | string | null;
    hasEstimatedPrice: boolean;
  }>;
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function aggregateOperatorSessionSales(rows: readonly ShiftSessionSaleRow[]): OperatorSessionSales[] {
  const sessions = new Map<string, OperatorSessionSales>();
  const packTotals = new Map<string, OperatorSessionSales["packs"][number]>();

  for (const row of rows) {
    const legacyAttribution = row.sessionId == null;
    const sessionKey = `${row.shiftId}:${row.sessionId ?? `legacy:${row.employeeId ?? "unknown"}`}@${row.terminalId ?? "unknown"}`;
    let session = sessions.get(sessionKey);
    if (!session) {
      session = {
        shiftId: row.shiftId,
        sessionId: row.sessionId,
        employeeId: row.employeeId,
        employeeName: row.employeeName || "Unknown employee",
        terminalId: row.terminalId,
        signedInAt: row.signedInAt,
        endedAt: row.endedAt,
        legacyAttribution,
        tickets: 0,
        grossSales: 0,
        hasEstimatedPrice: false,
        packs: [],
      };
      sessions.set(sessionKey, session);
    }

    const packKey = `${sessionKey}:${row.packId}`;
    let pack = packTotals.get(packKey);
    if (!pack) {
      pack = {
        packId: row.packId,
        pack: row.pack,
        game: row.game,
        display: row.display,
        tickets: 0,
        grossSales: 0,
        firstSaleAt: row.firstSaleAt,
        lastSaleAt: row.lastSaleAt,
        hasEstimatedPrice: false,
      };
      packTotals.set(packKey, pack);
      session.packs.push(pack);
    }

    const tickets = Number(row.tickets) || 0;
    const sales = Number(row.sales ?? 0) || 0;
    session.tickets += tickets;
    session.grossSales += sales;
    session.hasEstimatedPrice ||= row.hasEstimatedPrice;
    pack.tickets += tickets;
    pack.grossSales += sales;
    pack.hasEstimatedPrice ||= row.hasEstimatedPrice;
    if (row.firstSaleAt && (!pack.firstSaleAt || new Date(row.firstSaleAt) < new Date(pack.firstSaleAt))) pack.firstSaleAt = row.firstSaleAt;
    if (row.lastSaleAt && (!pack.lastSaleAt || new Date(row.lastSaleAt) > new Date(pack.lastSaleAt))) pack.lastSaleAt = row.lastSaleAt;
  }

  for (const session of sessions.values()) {
    session.grossSales = roundCurrency(session.grossSales);
    for (const pack of session.packs) pack.grossSales = roundCurrency(pack.grossSales);
    session.packs.sort((a, b) => a.display == null ? (b.display == null ? a.pack.localeCompare(b.pack, undefined, { numeric: true }) : 1) : b.display == null ? -1 : a.display.localeCompare(b.display, undefined, { numeric: true }) || a.pack.localeCompare(b.pack, undefined, { numeric: true }));
  }

  return Array.from(sessions.values()).sort((a, b) => {
    const timeDelta = new Date(a.signedInAt ?? 0).getTime() - new Date(b.signedInAt ?? 0).getTime();
    return timeDelta || (a.terminalId ?? "").localeCompare(b.terminalId ?? "") || a.employeeName.localeCompare(b.employeeName);
  });
}
