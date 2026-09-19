"use client";

import { useEffect } from "react";

export type LottoOpsInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __lottoOpsInstallPrompt?: LottoOpsInstallPromptEvent;
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__lottoOpsInstallPrompt = event as LottoOpsInstallPromptEvent;
      window.dispatchEvent(new Event("lottoops-install-prompt-ready"));
    };
    const markInstalled = () => {
      window.__lottoOpsInstallPrompt = undefined;
      window.dispatchEvent(new Event("lottoops-app-installed"));
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  return null;
}
