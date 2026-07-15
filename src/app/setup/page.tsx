"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);

  // First check if setup is even needed
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => {
        if (!d.needed) {
          setAlreadySetup(true);
          setTimeout(() => router.push("/login"), 2000);
        }
      })
      .finally(() => setChecking(false));
  }, [router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, storeName, timezone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Setup failed."); return; }
      setDone(true);
      setTimeout(() => router.push("/owner"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    );
  }

  if (alreadySetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
          <p className="font-semibold text-text">Setup already complete.</p>
          <p className="text-sm text-text-secondary mt-1">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
          <p className="font-semibold text-text">Setup complete! Welcome to LottoOps.</p>
          <p className="text-sm text-text-secondary mt-1">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-accent/10 mb-4">
            <Building2 size={28} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text">Welcome to LottoOps</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Set up your owner account and first store location to get started.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
            ⚡ First-time setup — runs once
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="pb-2 mb-2 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Owner Account</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Your Full Name</label>
              <input
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="you@yourbusiness.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="pt-2 mt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">First Store Location</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Store Name</label>
              <input
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Sunrise Mart #1"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Timezone</label>
              <select
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="America/Chicago">Central Time (CT) — Texas</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (no DST)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Creating account...</>
              ) : (
                "Create Owner Account & Store"
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-tertiary">
          This page is only accessible until the first owner account is created.
          <br />After setup, use the <a href="/login" className="text-accent hover:underline">login page</a>.
        </p>
      </div>
    </div>
  );
}
