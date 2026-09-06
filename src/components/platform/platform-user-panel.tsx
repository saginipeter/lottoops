"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Shield, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  store: { id: string; name: string };
}

export function PlatformUserPanel() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load users.");
      setUsers(data.users ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function action(user: PlatformUser, body: Record<string, unknown>) {
    const response = await fetch("/api/platform/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...body }),
    });
    if (response.ok) await load();
    else setError((await response.json()).error || "Unable to update user.");
  }

  async function resetPassword(user: PlatformUser) {
    const password = window.prompt(`Enter a new unique password for ${user.name}:`);
    if (!password) return;
    await action(user, { password });
  }

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-2">
        <Shield size={18} className="mt-0.5 text-accent" />
        <div>
          <h3 className="text-base font-semibold text-text">Global User Access</h3>
          <p className="mt-1 text-sm text-text-secondary">Review customer users, reset passwords, deactivate accounts, or revoke active sessions.</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading users...</div> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Store</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Status</th><th className="py-2">Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="py-2.5 pr-3"><span className="font-medium text-text">{user.name}</span><br /><span className="text-xs text-text-secondary">{user.email}</span></td><td className="py-2.5 pr-3 text-text-secondary">{user.store.name}</td><td className="py-2.5 pr-3 text-text-secondary">{user.role}</td><td className="py-2.5 pr-3">{user.active ? <span className="text-emerald-700">Active</span> : <span className="text-red-700">Inactive</span>}</td><td className="py-2.5"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { void resetPassword(user); }}><KeyRound size={13} />Reset password</Button><Button size="sm" variant="outline" onClick={() => { void action(user, { revokeSessions: true }); }}><Shield size={13} />Revoke sessions</Button><Button size="sm" variant="outline" onClick={() => { void action(user, { active: !user.active }); }}>{user.active ? <UserX size={13} /> : <UserCheck size={13} />}{user.active ? "Deactivate" : "Activate"}</Button></div></td></tr>)}</tbody></table></div>}
    </Panel>
  );
}
