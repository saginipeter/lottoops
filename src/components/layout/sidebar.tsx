"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle,
  LayoutDashboard,
  Package,
  Layers,
  ScanLine,
  Clock,
  BarChart3,
  Tv,
  Settings,
  ChevronDown,
  Gamepad2,
  Radio,
  Users,
  Building2,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: string;
  alert?: boolean;
  managerOnly?: boolean;
  ownerOnly?: boolean;
  permission?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navTop: NavItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };



const navSections: NavSection[] = [
  {
    label: "Daily Operations",
    items: [
      {
        href: "/inventory/live-scan",
        label: "Live Scan",
        icon: Radio,
      },
      {
        href: "/shifts",
        label: "Shifts",
        icon: Clock,
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        href: "/inventory/receive",
        label: "Receive Shipment",
        icon: ScanLine,
        permission: "RECEIVE_SHIPMENTS",
      },
      {
        href: "/display-slots",
        label: "Displays",
        icon: Tv,
      },
      {
        href: "/inventory",
        label: "Back Stock",
        icon: Package,
      },
      {
        href: "/inventory/active",
        label: "Active Stock",
        icon: Layers,
      },
      {
        href: "/inventory/returned",
        label: "Returned Tickets",
        icon: RotateCcw,
      },
    ],
  },
  {
    label: "Sales & Reports",
    items: [
      { href: "/sales", label: "Sales", icon: ScanLine },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle, managerOnly: true },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/owner", label: "All Stores", icon: Building2, ownerOnly: true },
      { href: "/games", label: "Games", icon: Gamepad2, managerOnly: true },
      { href: "/settings/users", label: "Staff", icon: Users, managerOnly: true },
      { href: "/settings/tv-display", label: "TV Display", icon: Tv, managerOnly: true },
      { href: "/settings", label: "Settings", icon: Settings, managerOnly: true },
    ],
  },
];

const ownerNavSections: NavSection[] = [
  {
    label: "Portfolio",
    items: [
      { href: "/owner", label: "Overview", icon: LayoutDashboard },
      { href: "/owner/stores", label: "Stores", icon: Building2 },
      { href: "/reports", label: "Performance", icon: BarChart3 },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
      { href: "/settings/users", label: "People & Access", icon: Users },
      { href: "/settings", label: "Account Settings", icon: Settings },
      { href: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
];

const platformNavSections: NavSection[] = [
  {
    label: "LottoOps Platform",
    items: [
      { href: "/platform", label: "Control Center", icon: LayoutDashboard },
    ],
  },
];

const roleLabel: Record<string, string> = {
  OWNER:      "Owner",
  MANAGER:    "Manager",
  SHIFT_LEAD: "Shift Lead",
  EMPLOYEE:   "Employee",
};

interface SidebarProps {
  user: {
    name: string;
    role: string;
    storeName: string;
    initials: string;
    grantedPermissions: string[];
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
  const isManager = user.role === "MANAGER" || user.role === "OWNER";
  const isOwner = user.role === "OWNER";
  const hasPermission = (permission?: string) =>
    !permission || isManager || user.grantedPermissions.includes(permission);

  return (
    <aside className="flex h-full w-[200px] flex-col bg-sidebar">
      {/* Logo + Store Name */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={108}
            height={36}
            className="h-7 w-auto"
            priority
          />
          <div className="text-[9px] uppercase tracking-wider text-white/35 mt-3 -ml-0.5">
            Lottery Scratch_off Management System
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5">
          <Building2 size={11} className="shrink-0 text-accent/70" />
          <span className="truncate text-[11px] font-medium text-white/75">{user.storeName}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavRow item={navTop} isActive={pathname === "/"} />

        {(user.role === "PLATFORM_ADMIN" ? platformNavSections : isOwner ? ownerNavSections : navSections).map((section) => {
          const visibleItems = section.items.filter(
            (item) => (!item.managerOnly || isManager) && (!item.ownerOnly || isOwner) && hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <div className="px-2 pb-1 pt-3 text-[9px] uppercase tracking-widest text-white/30">
                {section.label}
              </div>
           


              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/inventory"
                    ? pathname === "/inventory"
                    : pathname === item.href.split("#")[0] || pathname.startsWith(item.href.split("#")[0] + "/");

                return (
                  <NavRow
                    key={item.label}
                    item={item}
                    isActive={isActive}
                  />
                );
              })}
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
