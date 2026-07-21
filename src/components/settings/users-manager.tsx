"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Edit2, ToggleLeft, ToggleRight, KeyRound, X, Check, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type Role = "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE";

const GRANTABLE_PERMISSIONS = [
  { key: "REPORTS",           label: "View Reports" },
  { key: "RECEIVE_SHIPMENTS", label: "Receive Shipments" },
  { key: "MANAGE_BACKSTOCK",  label: "Manage Back Stock" },
  { key: "MANAGE_DISPLAY",    label: "Manage Displays" },
  { key: "MANAGE_GAMES",      label: "Manage Games" },
];

interface StoreUser {
  id: string;
  name: string;
  email: string;
  employeeUserId?: string | null;
  role: Role;
  grantedPermissions: string[];
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER:      "Owner",
  MANAGER:    "Manager",
  SHIFT_LEAD: "Shift Lead",
  EMPLOYEE:   "Employee",
};

const ROLE_COLORS: Record<Role, string> = {
  OWNER:      "bg-amber-100 text-amber-700",
  MANAGER:    "bg-purple-100 text-purple-700",
  SHIFT_LEAD: "bg-blue-100 text-blue-700",
  EMPLOYEE:   "bg-gray-100 text-gray-600",
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

interface AddUserFormProps {
  onCreated: (user: StoreUser) => void;
  onCancel: () => void;
  canCreateOwner: boolean;
}

function AddUserForm({ onCreated, onCancel, canCreateOwner }: AddUserFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeUserId, setEmployeeUserId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, employeeUserId, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create user."); return; }
      onCreated(data.user);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Full Name</label>
          <input
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="jane@store.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Employee User ID</label>
          <input
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Optional unique employee ID"
            value={employeeUserId}
            onChange={(e) => setEmployeeUserId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Temporary Password</label>
          <input
            type="password"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
          <select
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="EMPLOYEE">Employee — Shifts &amp; scan only</option>
            <option value="SHIFT_LEAD">Shift Lead — Shifts + grantable extras</option>
            <option value="MANAGER">Manager — Full access, no delete</option>
            {canCreateOwner && <option value="OWNER">Owner — Full access + delete</option>}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
          Create User
        </Button>
      </div>
    </form>
  );
}

interface EditUserModalProps {
  user: StoreUser;
  onUpdated: (user: StoreUser) => void;
  onClose: () => void;
  canCreateOwner: boolean;
}

function EditUserModal({ user, onUpdated, onClose, canCreateOwner }: EditUserModalProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [employeeUserId, setEmployeeUserId] = useState(user.employeeUserId ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [newPassword, setNewPassword] = useState("");
  const [grants, setGrants] = useState<string[]>(user.grantedPermissions ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGrant(key: string) {
    setGrants((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email,
        employeeUserId,
        role,
        grantedPermissions: role === "SHIFT_LEAD" ? grants : [],
      };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update."); return; }
      onUpdated(data.user);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">Edit User</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Full Name</label>
            <input
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Employee User ID</label>
            <input
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Optional unique employee ID"
              value={employeeUserId}
              onChange={(e) => setEmployeeUserId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
            <select
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="EMPLOYEE">Employee — Shifts &amp; scan only</option>
              <option value="SHIFT_LEAD">Shift Lead — Shifts + grantable extras</option>
              <option value="MANAGER">Manager — Full access, no delete</option>
              {canCreateOwner && <option value="OWNER">Owner — Full access + delete</option>}
            </select>
          </div>

          {/* Granted permissions panel — only shown when role is SHIFT_LEAD */}
          {role === "SHIFT_LEAD" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={13} className="text-blue-600" />
                <p className="text-xs font-semibold text-blue-700">Granted Permissions</p>
              </div>
              <div className="space-y-1.5">
                {GRANTABLE_PERMISSIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={grants.includes(key)}
                      onChange={() => toggleGrant(key)}
                      className="accent-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Reset Password <span className="text-text-tertiary font-normal">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="New password (min. 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={newPassword ? 8 : undefined}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UsersManager({ currentUserRole }: { currentUserRole: Role }) {
  const canCreateOwner = currentUserRole === "OWNER";
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<StoreUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function toggleActive(user: StoreUser) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      setMessage(`${data.user.name} ${data.user.active ? "activated" : "deactivated"}.`);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  function handleCreated(newUser: StoreUser) {
    setUsers((prev) => [...prev, newUser]);
    setShowAddForm(false);
    setMessage(`${newUser.name} added successfully.`);
    setTimeout(() => setMessage(null), 3000);
  }

  function handleUpdated(updated: StoreUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
    setMessage(`${updated.name} updated.`);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-4">
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onUpdated={handleUpdated}
          onClose={() => setEditingUser(null)}
          canCreateOwner={canCreateOwner}
        />
      )}

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text">Staff Members</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {users.filter((u) => u.active).length} active · {users.filter((u) => !u.active).length} inactive
            </p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} disabled={loading}>
            <UserPlus size={14} className="mr-1.5" />
            Add Staff
          </Button>
        </div>

        {message && (
          <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">{message}</div>
        )}

        {showAddForm && (
          <div className="mb-5 rounded-lg border border-border bg-surface-soft p-4">
            <h4 className="text-sm font-semibold text-text mb-3">New Staff Member</h4>
            <AddUserForm onCreated={handleCreated} onCancel={() => setShowAddForm(false)} canCreateOwner={canCreateOwner} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-tertiary">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading staff...
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">No staff members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Employee ID</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last Login</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b border-border ${!user.active ? "opacity-50" : ""}`}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                          {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-medium text-text">{user.name}</span>
                          {user.role === "SHIFT_LEAD" && user.grantedPermissions?.length > 0 && (
                            <p className="text-[10px] text-text-tertiary">
                              +{user.grantedPermissions.length} permission{user.grantedPermissions.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">{user.employeeUserId ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-text-secondary">{user.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${user.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-text-secondary">{formatDate(user.lastLoginAt)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(user)}
                          title="Edit"
                          className="rounded p-1.5 text-text-tertiary hover:bg-surface-soft hover:text-text transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          title={user.active ? "Deactivate" : "Activate"}
                          className="rounded p-1.5 text-text-tertiary hover:bg-surface-soft hover:text-text transition-colors"
                        >
                          {user.active ? <ToggleRight size={15} className="text-green-600" /> : <ToggleLeft size={15} />}
                        </button>
                        <button
                          onClick={() => setEditingUser(user)}
                          title="Reset password"
                          className="rounded p-1.5 text-text-tertiary hover:bg-surface-soft hover:text-text transition-colors"
                        >
                          <KeyRound size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Role reference */}
      <Panel className="p-5">
        <h3 className="text-sm font-semibold text-text mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[
            {
              role: "Owner", color: "bg-amber-100 text-amber-700 border-amber-200",
              perms: ["Full access — all stores", "Delete records permanently", "Create & manage all staff", "Billing & subscription", "All manager permissions"],
            },
            {
              role: "Manager", color: "bg-purple-100 text-purple-700 border-purple-200",
              perms: ["Full system access", "User management (no delete)", "Reports & CSV export", "Games & settings", "All operations"],
            },
            {
              role: "Shift Lead", color: "bg-blue-100 text-blue-700 border-blue-200",
              perms: ["Open & close shifts", "Live scan sales", "Extras granted by Manager", "Cannot make corrections"],
            },
            {
              role: "Employee", color: "bg-gray-100 text-gray-600 border-gray-200",
              perms: ["Open & close shifts", "Live scan sales only", "No corrections allowed", "No reports, no settings"],
            },
          ].map((r) => (
            <div key={r.role} className={`rounded-lg border p-3 ${r.color}`}>
              <p className="font-semibold mb-2">{r.role}</p>
              <ul className="space-y-1">
                {r.perms.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <Check size={10} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
