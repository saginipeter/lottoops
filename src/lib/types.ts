import { Pack, Game } from "@prisma/client";

export type PackWithGame = Pack & {
  game: Game;
};

export interface ShipmentState {
  id: string;

  invoiceNumber: string;
  invoicePhoto?: string;
  
  // Step 3 & 4: Shipment confirmation fields
  shipmentConfirmationNumber?: string;
  confirmationReceiptPhoto?: string;

  shipmentDate: string;

  receivedBy: string;

  expectedPacks: number;
  scannedPacks: number;

  status: string;
}