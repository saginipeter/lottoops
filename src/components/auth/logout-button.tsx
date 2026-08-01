"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export function LogoutButton({ className, label = "Sign out" }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-strong",
        className
      )}
      title="Sign out"
    >
      <LogOut size={13} />
      {label}
    </button>
  );
}
