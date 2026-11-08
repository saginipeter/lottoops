"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldEnforceInactivityTimeout } from "@/lib/inactivity-policy";

const IDLE_LIMIT_MS = 10 * 60 * 1000;
const WARNING_MS = 30 * 1000;

export function InactivityGuard({ role, rememberMe = false }: { role: string; rememberMe?: boolean }) {
  const [warningSeconds, setWarningSeconds] = useState<number | null>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const warningActive = useRef(false);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("The server could not end this session.");
      window.location.replace("/login?reason=inactivity");
    } catch {
      warningActive.current = true;
      setLogoutFailed(true);
      setWarningSeconds(0);
    }
  }, []);

  useEffect(() => {
    if (!shouldEnforceInactivityTimeout(role, rememberMe)) return;
    let idleTimer: number | undefined;
    let warningTimer: number | undefined;
    let countdownTimer: number | undefined;

    const clearTimers = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      if (warningTimer) window.clearTimeout(warningTimer);
      if (countdownTimer) window.clearInterval(countdownTimer);
    };

    const startIdleTimer = () => {
      clearTimers();
      warningActive.current = false;
      setLogoutFailed(false);
      setWarningSeconds(null);
      idleTimer = window.setTimeout(() => {
        setWarningSeconds(30);
        warningActive.current = true;
        countdownTimer = window.setInterval(() => {
          setWarningSeconds((value) => {
            if (value === null || value <= 1) {
              if (countdownTimer) window.clearInterval(countdownTimer);
              return 0;
            }
            return value - 1;
          });
        }, 1000);
        warningTimer = window.setTimeout(() => { void logout(); }, WARNING_MS);
      }, IDLE_LIMIT_MS);
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const onActivity = () => {
      if (!warningActive.current) startIdleTimer();
    };
    activityEvents.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    startIdleTimer();
    return () => {
      clearTimers();
      activityEvents.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [logout, role, rememberMe]);

  if (warningSeconds === null) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17233f]/65 p-4" role="alertdialog" aria-modal="true" aria-label="Inactivity warning"><div className="w-full max-w-md border-2 border-amber-500 bg-white p-6 text-center shadow-2xl"><AlertTriangle className="mx-auto text-amber-600" size={38} /><h2 className="mt-3 text-xl font-bold text-[#17233f]">{logoutFailed ? "You are still signed in" : "Session ending soon"}</h2><p className="mt-2 text-sm text-slate-600">{logoutFailed ? "The sign-out request did not complete, so this page is still authenticated. Retry signing out or continue working." : "You will be signed out because there has been no activity."}</p>{!logoutFailed && <p className="mt-4 text-4xl font-black tabular-nums text-amber-700">{warningSeconds}s</p>}{logoutFailed && <Button className="mt-5 min-h-12 w-full bg-red-700 text-base font-bold hover:bg-red-800" onClick={() => { void logout(); }}>Retry sign out</Button>}<Button className="mt-3 min-h-12 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-700" onClick={() => { warningActive.current = false; setLogoutFailed(false); setWarningSeconds(null); }}>Continue working</Button></div></div>;
}
