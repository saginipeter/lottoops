import type { PackWithGame } from "@/lib/types";

export const DRAFT_PACK_PREFIX = "draft-";

export function isDraftPack(pack: Pick<PackWithGame, "id">): boolean {
  return pack.id.startsWith(DRAFT_PACK_PREFIX);
}
