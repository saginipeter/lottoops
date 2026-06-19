import { Game, Pack, ScanLogEntry } from "./types";

// Real current Texas Lottery scratch-off games (texaslottery.com, June 2026).
// Tickets-per-pack follows typical TX Lottery pack conventions by price point.
export const games: Game[] = [
  { id: "g1", gameNumber: "2739", name: "King of Cash", price: 2, ticketsPerPack: 150 },
  { id: "g2", gameNumber: "2727", name: "All About the 8s", price: 5, ticketsPerPack: 75 },
  { id: "g3", gameNumber: "2733", name: "Mega Cash!", price: 10, ticketsPerPack: 40 },
  { id: "g4", gameNumber: "2613", name: "200X The Cash", price: 20, ticketsPerPack: 30 },
  { id: "g5", gameNumber: "2730", name: "Millionaire's Club", price: 30, ticketsPerPack: 20 },
  { id: "g6", gameNumber: "2711", name: "30X The Cash Word Search", price: 3, ticketsPerPack: 125 },
];

export const packs: Pack[] = [
  {
    id: "p1",
    serialNumber: "2739-0334219",
    gameId: "g1",
    status: "back-stock",
    cost: 240,
    retailValue: 300, // 150 tickets x $2
    receivedAt: "2026-06-15T09:12:00Z",
    receivedBy: "M. Alvarez",
  },
  {
    id: "p2",
    serialNumber: "2733-0091873",
    gameId: "g3",
    status: "back-stock",
    cost: 320,
    retailValue: 400, // 40 tickets x $10
    receivedAt: "2026-06-15T09:14:00Z",
    receivedBy: "M. Alvarez",
  },
  {
    id: "p3",
    serialNumber: "2711-1129944",
    gameId: "g6",
    status: "active",
    cost: 300,
    retailValue: 375, // 125 tickets x $3
    receivedAt: "2026-06-10T08:30:00Z",
    receivedBy: "J. Kim",
    slotId: "slot-3",
    currentTicketNumber: 88,
  },
  {
    id: "p4",
    serialNumber: "2727-0772104",
    gameId: "g2",
    status: "active",
    cost: 300,
    retailValue: 375, // 75 tickets x $5
    receivedAt: "2026-06-11T10:05:00Z",
    receivedBy: "J. Kim",
    slotId: "slot-5",
    currentTicketNumber: 12,
  },
  {
    id: "p5",
    serialNumber: "2613-0040112",
    gameId: "g4",
    status: "back-stock",
    cost: 480,
    retailValue: 600, // 30 tickets x $20
    receivedAt: "2026-06-16T14:22:00Z",
    receivedBy: "M. Alvarez",
  },
  {
    id: "p6",
    serialNumber: "2730-0556321",
    gameId: "g5",
    status: "sold-out",
    cost: 480,
    retailValue: 600, // 20 tickets x $30
    receivedAt: "2026-06-08T08:00:00Z",
    receivedBy: "J. Kim",
    slotId: "slot-1",
    currentTicketNumber: 0,
  },
  {
    id: "p7",
    serialNumber: "2739-0334220",
    gameId: "g1",
    status: "back-stock",
    cost: 240,
    retailValue: 300,
    receivedAt: "2026-06-16T14:25:00Z",
    receivedBy: "M. Alvarez",
  },
  {
    id: "p8",
    serialNumber: "2711-1129945",
    gameId: "g6",
    status: "back-stock",
    cost: 300,
    retailValue: 375,
    receivedAt: "2026-06-17T08:02:00Z",
    receivedBy: "M. Alvarez",
  },
  {
    id: "p9",
    serialNumber: "2613-0040115",
    gameId: "g4",
    status: "active",
    cost: 480,
    retailValue: 600,
    receivedAt: "2026-06-05T08:00:00Z",
    receivedBy: "J. Kim",
    slotId: "slot-2",
    currentTicketNumber: 18,
  },
  {
    id: "p10",
    serialNumber: "2733-0091880",
    gameId: "g3",
    status: "active",
    cost: 320,
    retailValue: 400,
    receivedAt: "2026-06-06T08:00:00Z",
    receivedBy: "J. Kim",
    slotId: "slot-4",
    currentTicketNumber: 25,
  },
  {
    id: "p11",
    serialNumber: "2730-0556330",
    gameId: "g5",
    status: "active",
    cost: 480,
    retailValue: 600,
    receivedAt: "2026-06-07T08:00:00Z",
    receivedBy: "M. Alvarez",
    slotId: "slot-6",
    currentTicketNumber: 4,
  },
  {
    id: "p12",
    serialNumber: "2739-0334230",
    gameId: "g1",
    status: "active",
    cost: 240,
    retailValue: 300,
    receivedAt: "2026-06-09T08:00:00Z",
    receivedBy: "M. Alvarez",
    slotId: "slot-7",
    currentTicketNumber: 117,
  },
];

export const scanLog: ScanLogEntry[] = [
  {
    id: "s1",
    timestamp: "2026-06-17T08:02:00Z",
    action: "received",
    packId: "p8",
    serialNumber: "2711-1129945",
    gameName: "30X The Cash Word Search",
    performedBy: "M. Alvarez",
    detail: "Received into back stock",
  },
  {
    id: "s2",
    timestamp: "2026-06-16T14:25:00Z",
    action: "received",
    packId: "p7",
    serialNumber: "2739-0334220",
    gameName: "King of Cash",
    performedBy: "M. Alvarez",
    detail: "Received into back stock",
  },
  {
    id: "s3",
    timestamp: "2026-06-16T14:22:00Z",
    action: "received",
    packId: "p5",
    serialNumber: "2613-0040112",
    gameName: "200X The Cash",
    performedBy: "M. Alvarez",
    detail: "Received into back stock",
  },
  {
    id: "s4",
    timestamp: "2026-06-12T18:40:00Z",
    action: "sold-out",
    packId: "p6",
    serialNumber: "2730-0556321",
    gameName: "Millionaire's Club",
    performedBy: "J. Kim",
    detail: "Marked sold out at shift close, slot 1",
  },
  {
    id: "s5",
    timestamp: "2026-06-17T09:22:00Z",
    action: "activated",
    packId: "p9",
    serialNumber: "2613-0040115",
    gameName: "200X The Cash",
    performedBy: "M. Alvarez",
    detail: "Activated to slot 02",
  },
  {
    id: "s6",
    timestamp: "2026-06-17T09:00:00Z",
    action: "shift-open",
    packId: "",
    serialNumber: "",
    gameName: "",
    performedBy: "M. Alvarez",
    detail: "Shift #SH-20260617-1 opened",
  },
  {
    id: "s7",
    timestamp: "2026-06-16T23:59:00Z",
    action: "shift-close",
    packId: "",
    serialNumber: "",
    gameName: "",
    performedBy: "C. Torres",
    detail: "Shift #SH-20260616-2 closed — $2,108 reconciled",
  },
];

// Current open shift snapshot for the dashboard banner and reconciliation card.
export const currentShift = {
  id: "SH-20260617-1",
  label: "Day shift",
  openedAt: "2026-06-17T09:00:00Z",
  activeLines: 7,
  linesCompleted: 5,
  variance: 0,
  pendingLines: [
    { slotNumber: "02", gameName: "200X The Cash" },
    { slotNumber: "06", gameName: "Millionaire's Club" },
  ],
};

// Top sellers today, by retail dollars sold (mock).
export const topSellersToday = [
  { gameName: "Millionaire's Club", amount: 750, share: 92 },
  { gameName: "30X The Cash Word Search", amount: 340, share: 61 },
  { gameName: "Mega Cash!", amount: 210, share: 38 },
  { gameName: "All About the 8s", amount: 112, share: 26 },
  { gameName: "King of Cash", amount: 70, share: 13 },
];

// Weekly profit snapshot for the dashboard tracker card.
export const profitSnapshot = {
  retailValueSold: 9240,
  packCost: 7530,
  netProfit: 1710,
  marginPercent: 18.5,
};

// Today's headline metrics for the stat row.
export const todayMetrics = {
  salesToday: 1482,
  salesChangePercent: 12,
  ticketsSold: 247,
  ticketsSinceLastHour: 41,
  activeDisplays: 7,
  totalSlots: 10,
  soldOutCount: 1,
  emptySlots: 2,
};
