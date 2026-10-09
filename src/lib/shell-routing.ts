import type { SessionPayload } from "@/lib/session";

export type AppShell = "pos" | "admin" | "platform-admin";

export const SHELL_ROUTES: Record<AppShell, { home: string; label: string }> = {
  pos: { home: "/pos", label: "POS Operations" },
  admin: { home: "/admin", label: "Store Admin" },
  "platform-admin": { home: "/platform-admin", label: "LottoOps Platform" },
};

export function canEnterShell(session: SessionPayload, shell: AppShell): boolean {
  if (shell === "platform-admin") return session.role === "PLATFORM_ADMIN";
  if (shell === "admin") return ["OWNER", "MANAGER", "AUDITOR"].includes(session.role);
  return ["OWNER", "MANAGER", "SHIFT_LEAD", "EMPLOYEE"].includes(session.role);
}

export function isAdminRole(role: SessionPayload["role"]): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "AUDITOR";
}
