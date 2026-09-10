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
  MapPin,
  Phone,
  ShieldCheck,
  RotateCcw,
  CreditCard,
  MessageCircle,
  CheckCircle2,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
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

const auditorNavSections: NavSection[] = [
  {
    label: "Review",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/support", label: "Support", icon: MessageCircle },
    ],
  },
];

const roleLabel: Record<string, string> = {
  OWNER:      "Owner",
  MANAGER:    "Manager",
  SHIFT_LEAD: "Shift Lead",
  EMPLOYEE:   "Employee",
  AUDITOR:    "Auditor",
};

interface SidebarProps {
  user: {
    name: string;
    role: string;
    storeName: string;
    storeNumber: string | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeTimezone: string | null;
    initials: string;
    grantedPermissions: string[];
  };
}

function NavRow({ item, isActive, collapsed = false }: { item: NavItem; isActive: boolean; collapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        clsx("group flex min-h-10 items-center rounded-lg text-[13px] font-medium transition-colors", collapsed ? "justify-center px-2" : "gap-3 px-3"),
        isActive
          ? "bg-accent text-white shadow-sm"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong"
      )}
    >
      <Icon size={17} strokeWidth={isActive ? 2.3 : 2} className="shrink-0" />
      <span className={clsx("truncate", collapsed && "hidden")}>{item.label}</span>
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isManager = user.role === "MANAGER" || user.role === "OWNER";
  const isOwner = user.role === "OWNER";
  const hasPermission = (permission?: string) =>
    !permission || isManager || user.grantedPermissions.includes(permission);

  const storeDetails = [
    user.storeNumber ? `Store ${user.storeNumber}` : null,
    user.storeAddress,
    user.storePhone,
  ].filter(Boolean);

  return (
    <>
    <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="fixed left-3 top-3 z-40 rounded-lg bg-sidebar p-2 text-white shadow-lg sm:hidden">
      <Menu size={20} />
    </button>
    <aside className={clsx(
      "h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200",
      collapsed ? "w-[72px]" : "w-[280px]",
      mobileOpen ? "fixed inset-y-0 left-0 z-50 flex w-[280px] shadow-2xl" : "hidden sm:flex",
    )}>
      <div className={clsx("border-b border-sidebar-border py-5", collapsed ? "px-3" : "px-5")}>
        <div className="flex items-center justify-between gap-3">
          <Image
            src="/brand/lottoops-logo.png"
            alt="LottoOps"
            width={collapsed ? 44 : 144}
            height={48}
            className={collapsed ? "h-8 w-8 object-contain object-left" : "h-10 w-auto"}
            priority
          />
          {!collapsed && <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-success">
            Online
          </span>}
          {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-white/70 hover:bg-white/10 sm:hidden"><X size={18} /></button>}
          {!mobileOpen && <button type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((value) => !value)} className="rounded-md p-1 text-white/60 hover:bg-white/10 sm:block"><Menu size={18} /></button>}
        </div>
        {!collapsed && <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
          Store operations console
        </p>}
        {!collapsed && <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.07] p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <Building2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">Current location</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{user.storeName}</p>
              {user.storeNumber && <p className="mt-0.5 text-[10px] text-white/50">Store {user.storeNumber}</p>}
            </div>
            <ChevronDown size={15} className="mt-1 shrink-0 text-white/40" />
          </div>
          {storeDetails.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-[10px] leading-4 text-white/55">
              {user.storeAddress && <p className="flex gap-2"><MapPin size={12} className="mt-0.5 shrink-0 text-accent/80" />{user.storeAddress}</p>}
              {user.storePhone && <p className="flex gap-2"><Phone size={12} className="mt-0.5 shrink-0 text-accent/80" />{user.storePhone}</p>}
              {user.storeTimezone && <p className="flex gap-2"><Clock size={12} className="mt-0.5 shrink-0 text-accent/80" />{user.storeTimezone}</p>}
            </div>
          )}
        </div>}
        {!collapsed && <div className="mt-3 flex items-center gap-2 text-[10px] text-white/45">
          <ShieldCheck size={13} className="text-success" />
          <span>Operational records protected</span>
        </div>}
      </div>

      <nav className={clsx("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-4")}>
        <NavRow item={navTop} isActive={pathname === "/"} collapsed={collapsed} />

        {(user.role === "PLATFORM_ADMIN" ? platformNavSections : user.role === "AUDITOR" ? auditorNavSections : isOwner ? ownerNavSections : navSections).map((section) => {
          const visibleItems = section.items.filter(
            (item) => (!item.managerOnly || isManager) && (!item.ownerOnly || isOwner) && hasPermission(item.permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mt-6 first:mt-5">
              <div className={clsx("flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35", collapsed && "hidden")}>
                {section.label}
                <span className="h-px flex-1 bg-white/10" />
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
                    collapsed={collapsed}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={clsx("border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
        <div className={clsx("rounded-xl border border-white/10 bg-white/[0.05]", collapsed ? "p-2" : "p-3")}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            {user.initials}
            </div>
            <div className={clsx("min-w-0 flex-1", collapsed && "hidden")}>
              <p className="truncate text-xs font-semibold text-white/90">{user.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">{roleLabel[user.role] ?? user.role}</p>
            </div>
          </div>
          <div className={clsx("mt-3 border-t border-white/10 pt-2", collapsed && "hidden")}>
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
    {mobileOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/30 sm:hidden" />}
    </>
  );
}
