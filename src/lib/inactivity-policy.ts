const INACTIVITY_PROTECTED_ROLES = new Set(["OWNER", "MANAGER"]);

/** A remembered session bypasses the short idle logout, but still expires at its signed session limit. */
export function shouldEnforceInactivityTimeout(role: string, rememberMe = false): boolean {
  return INACTIVITY_PROTECTED_ROLES.has(role) && !rememberMe;
}
