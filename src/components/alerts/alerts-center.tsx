"use client";

import { useState, type ReactNode } from "react";
import { OperationalAlertsPanel } from "./operational-alerts-panel";
import { alertCategories, type AlertCategory } from "./alert-categories";

export function AlertsCenter({ returns, shipments, discrepancies, tickets }: {
  returns: ReactNode; shipments: ReactNode; discrepancies: ReactNode; tickets: ReactNode;
}) {
  const [category, setCategory] = useState<AlertCategory>("ALL");
  const visible = (value: AlertCategory) => category === "ALL" || category === value;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4">
      <label htmlFor="alerts-center-category" className="text-sm font-semibold text-text">Alert category</label>
      <select id="alerts-center-category" value={category} onChange={(event) => setCategory(event.target.value as AlertCategory)} className="min-h-11 border border-border bg-surface px-3 text-sm text-text">
        {alertCategories.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <p className="text-xs text-text-secondary">Choose a category to focus the entire alert queue.</p>
    </div>
    <div hidden={!visible("RETURN")}>{returns}</div>
    <div hidden={!visible("SHIPMENT")}>{shipments}</div>
    <div hidden={category === "RETURN" || category === "TICKET"}>
      <OperationalAlertsPanel category={category} onCategoryChange={setCategory} />
    </div>
    <div hidden={!visible("AUDIT")}>{discrepancies}</div>
    <div hidden={!visible("TICKET")}>{tickets}</div>
  </div>;
}
