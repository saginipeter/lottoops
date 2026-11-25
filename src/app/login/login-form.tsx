"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [authenticatorStep, setAuthenticatorStep] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(authenticatorStep ? "/api/auth/mfa/verify" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authenticatorStep ? { code } : { email, password, rememberMe }),
      });
      const data = await response.json();
      if (response.status === 202 && data.mfaRequired) {
        setAuthenticatorStep(true);
        setCode("");
        setError("");
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }

      const requestedFrom = searchParams.get("from");
      const isShiftBoundStaff = data.user?.role === "EMPLOYEE" || data.user?.role === "SHIFT_LEAD";
      const needsExplicitShiftSelection = isShiftBoundStaff || data.user?.role === "MANAGER";
      const isShiftWorkflow = Boolean(requestedFrom && /^\/(shifts|inventory\/live-scan)(?:[/?#]|$)/.test(requestedFrom));
      const from = needsExplicitShiftSelection
        ? "/shifts"
        : isShiftWorkflow ? "/" : requestedFrom ?? "/";
      window.location.replace(from);
    } catch {
      setError("Unable to connect. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div role="alert" aria-live="assertive" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-base font-bold leading-6 text-danger-soft-text">{error}</div>}
      {!authenticatorStep && <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-text-secondary">Email address</label>
        <input ref={emailRef} id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-tertiary focus:border-[#0d82a6] focus:outline-none focus:ring-2 focus:ring-[#0d82a6]/20 transition-colors" />
      </div>}
      {!authenticatorStep && <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-text-secondary">Password</label>
        <div className="relative">
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="w-full rounded-md border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-text placeholder:text-text-tertiary focus:border-[#0d82a6] focus:outline-none focus:ring-2 focus:ring-[#0d82a6]/20 transition-colors" />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
      </div>}
      {!authenticatorStep && <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-text-secondary">
        <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-[#0d82a6]" />Keep me logged in
      </label>}
      {authenticatorStep && <div>
        <label htmlFor="authenticator-code" className="mb-1.5 block text-xs font-medium text-text-secondary">Authenticator code</label>
        <input id="authenticator-code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" aria-label="Authenticator code" className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.3em] text-text" />
        <p className="mt-2 text-xs text-text-secondary">Enter the 6-digit code from your authenticator app.</p>
      </div>}
      <button type="submit" disabled={loading || (authenticatorStep ? code.length !== 6 : !email || !password)} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-md bg-[#0d82a6] text-sm font-bold text-white transition-colors hover:bg-[#075f7d] disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? <><Loader2 size={15} className="animate-spin" />Signing in…</> : authenticatorStep ? "Verify and sign in" : "Sign in"}
      </button>
    </form>
  );
}
