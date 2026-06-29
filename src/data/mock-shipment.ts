export interface ShipmentPack {
  id: string;
  gameNumber: string;
  gameName: string;
  packNumber: string;
  firstTicket: string;
  ticketPrice: number;
  quantity: number;
  status: "Logged" | "Pending";
}

export const MOCK_SHIPMENT = {
  invoiceNumber: "TXL-0847",
  invoicePhoto: "",
  shipmentDate: new Date().toISOString().split("T")[0],
  receivedBy: "W. Opiyo",
  expectedPacks: 8,
  scannedPacks: 0,
  status: "In Progress",
};

export const PRICE_PRESETS = [
  { price: 1, quantity: 300 },
  { price: 2, quantity: 150 },
  { price: 3, quantity: 100 },
  { price: 5, quantity: 75 },
  { price: 10, quantity: 50 },
  { price: 20, quantity: 25 },
  { price: 30, quantity: 25 },
  { price: 100, quantity: 15 },
];

export const DENOMINATION_LOOKUP: Record<number, number> = {
  1: 300,
  2: 150,
  3: 100,
  5: 75,
  10: 50,
  20: 25,
  30: 25,
  100: 15,
};

export function parseBarcode(barcode: string) {
  const clean = barcode.replace(/\s/g, "");

  return {
    gameNumber: clean.substring(0, 4),
    packNumber: clean.substring(4, 10),
    firstTicket: clean.substring(10, 13),
  };
}

export const MOCK_PACKS: ShipmentPack[] = [];