"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Package,
  Layers,
  ScanLine,
  Clock,
  FileBarChart2,
  BarChart3,
  History,
  FileSpreadsheet,
  Users,
  Tv,
  Settings,
  ChevronDown,
  Gamepad2,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: string;
  alert?: boolean;
  managerOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navTop: NavItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };

const navSections: NavSection[] = [
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Back stock", icon: Package, badge: "12" },
      { href: "/slots", label: "Display slots", icon: Layers },
      { href: "/inventory/receive", label: "Receive packs", icon: ScanLine, alert: true },
    ],
  },
  {
    label: "Shifts",
    items: [
      { href: "/shifts", label: "Open shift", icon: Clock },
      { href: "/shifts", label: "Close shift", icon: FileBarChart2 },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports", label: "Daily summary", icon: BarChart3 },
      { href: "/reports", label: "Scan log", icon: History },
      { href: "/reports", label: "Profit report", icon: FileSpreadsheet },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/games", label: "Games", icon: Gamepad2, managerOnly: true },
      { href: "/settings", label: "Staff roles", icon: Users, managerOnly: true },
      { href: "/settings", label: "TV display", icon: Tv, managerOnly: true },
      { href: "/settings", label: "Settings", icon: Settings, managerOnly: true },
    ],
  },
];

const roleLabel: Record<string, string> = {
  MANAGER: "Manager",
  CLERK: "Clerk",
  VIEWER: "Viewer",
};

interface SidebarProps {
  user: {
    name: string;
    role: string;
    initials: string;
  };
}

function NavRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-xs transition-colors mb-px",
        isActive
          ? "bg-accent text-white"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong"
      )}
    >
      <Icon size={15} strokeWidth={2} />
      {item.label}
      {item.badge && (
        <span className="ml-auto rounded-full bg-white/15 px-[5px] py-[1px] text-[9px] text-white/70">
          {item.badge}
        </span>
      )}
      {item.alert && (
        <span className="ml-auto rounded-full bg-danger px-[5px] py-[1px] text-[9px] text-white">
          !
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isManager = user.role === "MANAGER";

  return (
    <aside className="flex h-full w-[200px] flex-col bg-sidebar">
      {/* Logo */}
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={108}
            height={36}
            className="h-7 w-auto"
            priority
          />
          <div className="text-[9px] uppercase tracking-wider text-white/35 mt-3 -ml-0.5">
            Texas Lottery
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavRow item={navTop} isActive={pathname === "/"} />

        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.managerOnly || isManager
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <div className="px-2 pb-1 pt-3 text-[9px] uppercase tracking-widest text-white/30">
                {section.label}
              </div>
              {visibleItems.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* User chip + logout */}
      <div className="border-t border-sidebar-border px-2 py-3">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-[7px] mb-1">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-white/85">
              {user.name}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-white/35">
              {roleLabel[user.role] ?? user.role}
            </p>
          </div>
          <ChevronDown size={12} className="text-white/30" />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
