export interface OfflineScan {
  id: string;
  serialNumber: string;
  terminalId: string;
  createdAt: string;
}

export function offlineScanQueueKey(terminalId: string) {
  return `lottoops:offline-scan-queue:${terminalId}`;
}

export function readOfflineScanQueue(storage: Storage | undefined, terminalId: string): OfflineScan[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(offlineScanQueueKey(terminalId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOfflineScan);
  } catch {
    return [];
  }
}

export function enqueueOfflineScan(
  storage: Storage | undefined,
  terminalId: string,
  serialNumber: string,
): OfflineScan[] {
  const normalizedSerial = serialNumber.trim();
  if (!storage || !normalizedSerial) return readOfflineScanQueue(storage, terminalId);

  const queue = readOfflineScanQueue(storage, terminalId);
  if (queue.some((item) => item.serialNumber === normalizedSerial)) return queue;

  const next = [
    ...queue,
    {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      serialNumber: normalizedSerial,
      terminalId,
      createdAt: new Date().toISOString(),
    },
  ].slice(-100);
  storage.setItem(offlineScanQueueKey(terminalId), JSON.stringify(next));
  return next;
}

export function removeOfflineScan(
  storage: Storage | undefined,
  terminalId: string,
  id: string,
): OfflineScan[] {
  const next = readOfflineScanQueue(storage, terminalId).filter((item) => item.id !== id);
  if (storage) storage.setItem(offlineScanQueueKey(terminalId), JSON.stringify(next));
  return next;
}

function isOfflineScan(value: unknown): value is OfflineScan {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.serialNumber === "string" &&
    typeof item.terminalId === "string" &&
    typeof item.createdAt === "string"
  );
}
