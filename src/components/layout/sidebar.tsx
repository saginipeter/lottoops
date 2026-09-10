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
  MessageCircle,
  CheckCircle2,
  FileText,
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
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/support", label: "Support", icon: MessageCircle },
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
      { href: "/onboarding", label: "Onboarding", icon: CheckCircle2, managerOnly: true },
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
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
      { href: "/settings/users", label: "People & Access", icon: Users },
      { href: "/settings", label: "Account Settings", icon: Settings },
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/support", label: "Support", icon: MessageCircle },
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
        "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-accent text-white shadow-sm"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong"
      )}
    >
      <Icon size={17} strokeWidth={isActive ? 2.3 : 2} className="shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/70">
          {item.badge}
        </span>
      )}
      {item.alert && (
        <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-[10px] text-white">
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

  const mobileItems = [
    navTop,
    navSections[0].items[0],
    navSections[0].items[1],
    navSections[1].items[0],
    navSections[2].items[1],
  ].filter((item) => hasPermission(item.permission));

  return (
    <>
    <aside className="hidden h-full w-[248px] shrink-0 flex-col bg-sidebar sm:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={132}
            height={44}
            className="h-9 w-auto"
            priority
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
          Lottery operations
        </p>
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5">
          <Building2 size={15} className="shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-white/40">Workspace</p>
            <p className="truncate text-xs font-semibold text-white/85">{user.storeName}</p>
          </div>
          <ChevronDown size={14} className="ml-auto shrink-0 text-white/40" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavRow item={navTop} isActive={pathname === "/"} />

        {(user.role === "PLATFORM_ADMIN" ? platformNavSections : isOwner ? ownerNavSections : navSections).map((section) => {
          const visibleItems = section.items.filter(
            (item) => (!item.managerOnly || isManager) && (!item.ownerOnly || isOwner) && hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mt-5 first:mt-4">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
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

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white/85">
              {user.name}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              {roleLabel[user.role] ?? user.role}
            </p>
          </div>
        </div>
        <div className="mt-1 px-1">
          <LogoutButton />
        </div>
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar px-1 pb-[env(safe-area-inset-bottom)] pt-1 sm:hidden">
      {mobileItems.map((item) => {
        const isActive = item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href} className={clsx("flex min-w-0 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px]", isActive ? "bg-accent text-white" : "text-sidebar-text")}>
            <Icon size={17} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}
