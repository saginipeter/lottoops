import type { SessionPayload } from "@/lib/session";

/**
 * Role hierarchy:
 *   OWNER      — full access, including hard deletes
 *   MANAGER    — full access, NO hard deletes
 *   SHIFT_LEAD — shift/scan + any explicitly granted extras
 *   EMPLOYEE   — shift open/close + live scan only, zero corrections
 *   AUDITOR    — reports and documents only, no operational writes
 */

/** Permissions that a MANAGER/OWNER can grant to a SHIFT_LEAD */
export const GRANTABLE_PERMISSIONS = {
  REPORTS:           "REPORTS",
  RECEIVE_SHIPMENTS: "RECEIVE_SHIPMENTS",
  MANAGE_BACKSTOCK:  "MANAGE_BACKSTOCK",
  MANAGE_DISPLAY:    "MANAGE_DISPLAY",
  MANAGE_GAMES:      "MANAGE_GAMES",
} as const;

export type GrantablePermission = keyof typeof GRANTABLE_PERMISSIONS;

/** Only OWNER can permanently delete records */
export function canDelete(session: SessionPayload): boolean {
  return session.role === "OWNER";
}

/** OWNER and MANAGER have full managerial access */
export function isManagerOrAbove(session: SessionPayload): boolean {
  return session.role === "OWNER" || session.role === "MANAGER";
}

/** Returns true only for the OWNER role */
export function isOwner(session: SessionPayload): boolean {
  return session.role === "OWNER";
}

export function isReadOnly(session: SessionPayload): boolean {
  return session.role === "AUDITOR";
}

/**
 * Check if the session has a specific permission.
 * OWNER/MANAGER always pass. SHIFT_LEAD passes only if the
 * permission was explicitly granted. EMPLOYEE never passes.
 */
export function hasPermission(
  session: SessionPayload,
  permission: string
): boolean {
  if (session.role === "AUDITOR") {
    return permission === GRANTABLE_PERMISSIONS.REPORTS;
  }
  if (session.role === "OWNER" || session.role === "MANAGER") return true;
  if (session.role === "SHIFT_LEAD") {
    return (session.grantedPermissions ?? []).includes(permission);
  }
  return false;
}

export const canAccessReports       = (s: SessionPayload) => hasPermission(s, GRANTABLE_PERMISSIONS.REPORTS);
export const canReceiveShipments    = (s: SessionPayload) => hasPermission(s, GRANTABLE_PERMISSIONS.RECEIVE_SHIPMENTS);
export const canManageBackstock     = (s: SessionPayload) => hasPermission(s, GRANTABLE_PERMISSIONS.MANAGE_BACKSTOCK);
export const canManageDisplay       = (s: SessionPayload) => hasPermission(s, GRANTABLE_PERMISSIONS.MANAGE_DISPLAY);
export const canManageGames         = (s: SessionPayload) => hasPermission(s, GRANTABLE_PERMISSIONS.MANAGE_GAMES);

/**
 * For an OWNER viewing a specific store via query param, or for
 * MANAGER/SHIFT_LEAD/EMPLOYEE who always operate on their own storeId.
 */
export function resolveStoreId(
  session: SessionPayload,
  requestedStoreId?: string | null
): string {
  if (session.role === "OWNER" && requestedStoreId) {
    return requestedStoreId;
  }
  return session.storeId;
}
