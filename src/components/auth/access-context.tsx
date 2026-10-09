"use client";

import { createContext, useContext } from "react";

export type AccessUser = {
  name: string;
  role: string;
  storeName: string;
  grantedPermissions: string[];
};

type AccessContextValue = AccessUser & {
  isOwner: boolean;
  isManager: boolean;
  isPlatformAdmin: boolean;
  can(permission: string): boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ user, children }: { user: AccessUser; children: React.ReactNode }) {
  const isOwner = user.role === "OWNER";
  const isManager = user.role === "MANAGER";
  const isPlatformAdmin = user.role === "PLATFORM_ADMIN";
  const can = (permission: string) => isOwner || isManager || user.grantedPermissions.includes(permission) || (user.role === "AUDITOR" && permission === "REPORTS");
  return <AccessContext.Provider value={{ ...user, isOwner, isManager, isPlatformAdmin, can }}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const access = useContext(AccessContext);
  if (!access) throw new Error("useAccess must be used inside AccessProvider");
  return access;
}
