import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Currency
 */
export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

/**
 * Numbers
 */
export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

/**
 * Dates
 */
export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Date + Time
 */
export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Time only
 */
export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Relative Time
 */
export function formatRelativeTime(date: Date | string) {
  const diff =
    Date.now() - new Date(date).getTime();

  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);

  if (hrs < 24) return `${hrs} hrs ago`;

  const days = Math.floor(hrs / 24);

  return `${days} days ago`;
}

/**
 * Progress %
 */
export function getProgress(current: number, total: number) {
  if (!total) return 0;

  return Math.round((current / total) * 100);
}

/**
 * Remaining tickets
 */
export function remainingTickets(
  currentTicket: number | null,
  ticketsPerPack: number
) {
  if (currentTicket == null) return ticketsPerPack;

  return Math.max(
    ticketsPerPack - currentTicket,
    0
  );
}

/**
 * Pack Status Colors
 */
export function getPackStatusColor(status: string) {
  switch (status) {
    case "BACK_STOCK":
      return "bg-yellow-100 text-yellow-700";

    case "ACTIVE":
      return "bg-green-100 text-green-700";

    case "SOLD_OUT":
      return "bg-red-100 text-red-700";

    case "RETURNED":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * Shipment Status Colors
 */
export function getShipmentStatusColor(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-700";

    case "RECEIVED":
      return "bg-green-100 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * Display Slot Number
 */
export function formatSlotNumber(slot: number | string) {
  return String(slot).padStart(2, "0");
}

/**
 * Ticket Number
 */
export function formatTicketNumber(ticket: number | null) {
  if (ticket == null) return "---";

  return String(ticket).padStart(3, "0");
}