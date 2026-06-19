"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong transition-colors w-full"
      title="Sign out"
    >
      <LogOut size={13} />
      Sign out
    </button>
  );
}
