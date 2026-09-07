import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { DocumentsBrowser } from "@/components/documents/documents-browser";
import { getSession } from "@/lib/get-session";
import { canAccessReports } from "@/lib/permissions";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessReports(session)) redirect("/");
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Header title="Documents" subtitle="Invoices, receipts, and inventory images" /><PageToolbar left={<span className="text-xs text-text-secondary">Store: {session.storeName}</span>} center={<span>Search document records</span>} right={<span className="text-xs text-text-tertiary">Document access</span>} /><div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"><DocumentsBrowser /></div><StatusBar left={<span>Document storage</span>} center={<span>Store scoped access</span>} right={<span>Open or download records</span>} /></div>;
}
