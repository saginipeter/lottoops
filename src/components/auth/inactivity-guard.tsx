"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const IDLE_LIMIT_MS = 10 * 60 * 1000;
const WARNING_MS = 30 * 1000;

export function InactivityGuard({ role }: { role: string }) {
  const router = useRouter();
  const [warningSeconds, setWarningSeconds] = useState<number | null>(null);
  const warningActive = useRef(false);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login?reason=inactivity");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (role !== "MANAGER" && role !== "OWNER") return;
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
  }, [logout, role]);

  if (warningSeconds === null) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17233f]/65 p-4" role="alertdialog" aria-modal="true" aria-label="Inactivity warning"><div className="w-full max-w-md border-2 border-amber-500 bg-white p-6 text-center shadow-2xl"><AlertTriangle className="mx-auto text-amber-600" size={38} /><h2 className="mt-3 text-xl font-bold text-[#17233f]">Session ending soon</h2><p className="mt-2 text-sm text-slate-600">You will be signed out because there has been no activity.</p><p className="mt-4 text-4xl font-black tabular-nums text-amber-700">{warningSeconds}s</p><Button className="mt-5 min-h-12 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-700" onClick={() => { warningActive.current = false; setWarningSeconds(null); }}>Continue working</Button></div></div>;
}
