export type PackStatus = "back-stock" | "active" | "sold-out" | "returned";

export interface Game {
  id: string;
  gameNumber: string; // state-assigned game number, e.g. "1487"
  name: string;
  price: number; // ticket price, e.g. 5, 10, 20
  ticketsPerPack: number;
}

export interface Pack {
  id: string;
  serialNumber: string;
  gameId: string;
  status: PackStatus;
  cost: number; // what the store paid
  retailValue: number; // ticketsPerPack * price
  receivedAt: string; // ISO date
  receivedBy: string;
  slotId?: string; // set once activated
  currentTicketNumber?: number; // tracked once active
  notes?: string;
}

export interface ScanLogEntry {
  id: string;
  timestamp: string;
  action: "received" | "activated" | "sold-out" | "shift-open" | "shift-close" | "returned";
  packId: string;
  serialNumber: string;
  gameName: string;
  performedBy: string;
  detail: string;
}

export interface DisplaySlot {
  slotNumber: string; // e.g. "01"
  pack: Pack | null;
}

export interface ShiftPendingLine {
  slotNumber: string;
  gameName: string;
}
