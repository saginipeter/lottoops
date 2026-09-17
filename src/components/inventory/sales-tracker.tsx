"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign } from "lucide-react";
import { Panel } from "@/components/ui/panel";

interface ShiftStats {
  ticketsSold: number;
  revenueTotal: number;
  packsSold: number;
  profitTotal?: number;
}

interface Sale {
  id: string;
  packId: string;
  gameNumber?: string;
  ticketsSold?: number;
  salesAmount?: number | string | null;
  recordedAt?: string;
  pack?: { serialNumber: string; game: { name: string } };
}

interface SalesTrackerProps {
  sales: Sale[];
  shiftStats: ShiftStats;
}

export function SalesTracker({ sales, shiftStats }: SalesTrackerProps) {
  const [averagePerPack, setAveragePerPack] = useState(0);

  useEffect(() => {
    if (shiftStats.packsSold > 0) {
      setAveragePerPack(shiftStats.revenueTotal / shiftStats.packsSold);
    }
  }, [shiftStats]);

  return (
    <Panel className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-bold mb-4">Sales Summary</h3>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-xs font-medium text-green-600 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-green-900">
              ${shiftStats.revenueTotal.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-xs font-medium text-emerald-600 mb-1">Store Profit (5%)</p>
            <p className="text-2xl font-bold text-emerald-900">
              ${(shiftStats.profitTotal ?? shiftStats.revenueTotal * 0.05).toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-medium text-blue-600 mb-1">Avg per Pack</p>
            <p className="text-2xl font-bold text-blue-900">
              ${averagePerPack.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <p className="text-xs font-medium text-purple-600 mb-1">Packs Sold</p>
            <p className="text-2xl font-bold text-purple-900">
              {shiftStats.packsSold}
            </p>
          </div>
        </div>

        {/* Recent Sales */}
        <div>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Recent Sales (Last 10)
          </h4>

          {sales.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sales.map((sale, idx) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {sale.pack?.game.name || `Pack ${idx + 1}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      #{sale.pack?.serialNumber || "unknown"}
                    </p>
                    {sale.recordedAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(sale.recordedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600 flex items-center gap-1">
                      <DollarSign size={14} />
                      {Number(sale.salesAmount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sale.ticketsSold || 0} tickets
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-600">No sales recorded yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Scan tickets to record sales
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
