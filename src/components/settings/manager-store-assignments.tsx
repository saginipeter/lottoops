"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";

interface StoreOption {
  id: string;
  name: string;
}

interface ManagerOption {
  id: string;
  name: string;
  email: string;
  storeId: string;
}

interface Assignment {
  managerId: string;
  storeId: string;
}

export function ManagerStoreAssignments() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/owner/manager-stores", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load assignments.");
        setStores(data.stores ?? []);
        setManagers(data.managers ?? []);
        setAssignments(data.assignments ?? []);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  function isAssigned(managerId: string, storeId: string) {
    return assignments.some((assignment) => assignment.managerId === managerId && assignment.storeId === storeId);
  }

  async function toggle(managerId: string, storeId: string) {
    const key = `${managerId}:${storeId}`;
    const action = isAssigned(managerId, storeId) ? "remove" : "assign";
    try {
      setSaving(key);
      setError("");
      const response = await fetch("/api/owner/manager-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId, storeId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update assignment.");
      setAssignments((previous) => action === "assign"
        ? [...previous, { managerId, storeId }]
        : previous.filter((assignment) => !(assignment.managerId === managerId && assignment.storeId === storeId)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update assignment.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <Panel className="p-5"><div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading manager assignments...</div></Panel>;
  }

  return (
    <Panel className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text">Manager Store Access</h3>
        <p className="mt-1 text-xs text-text-secondary">Assign a manager to one or more stores in your portfolio.</p>
      </div>
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {managers.length === 0 ? (
        <p className="text-sm text-text-secondary">No managers are available to assign.</p>
      ) : stores.length === 0 ? (
        <p className="text-sm text-text-secondary">No owned stores are available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-2 pr-4">Manager</th>
                {stores.map((store) => <th key={store.id} className="px-3 py-2 text-center">{store.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-text">{manager.name}</p>
                    <p className="text-xs text-text-tertiary">{manager.email}</p>
                  </td>
                  {stores.map((store) => {
                    const key = `${manager.id}:${store.id}`;
                    const assigned = isAssigned(manager.id, store.id);
                    return (
                      <td key={store.id} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(manager.id, store.id)}
                          disabled={saving === key}
                          aria-label={`${assigned ? "Remove" : "Assign"} ${manager.name} ${store.name}`}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${assigned ? "border-accent bg-accent text-white" : "border-border bg-surface text-transparent hover:border-accent"}`}
                        >
                          {saving === key ? <Loader2 size={14} className="animate-spin text-current" /> : <Check size={14} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
