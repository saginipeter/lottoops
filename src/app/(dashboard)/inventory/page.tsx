import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { BackStockList } from "@/components/inventory/back-stock-list";
import { getBackStockPacks } from "@/lib/utils";
import { Plus } from "lucide-react";

export default function InventoryPage() {
  const backStock = getBackStockPacks();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Back stock"
        subtitle={`${backStock.length} packs waiting to be activated`}
        actions={
          <Link href="/inventory/receive">
            <Button variant="primary">
              <Plus size={14} />
              Receive inventory
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <Panel>
          <BackStockList packs={backStock} />
        </Panel>
      </div>
    </div>
  );
}
