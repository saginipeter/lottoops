"use client";

import { useEffect } from "react";

const WARNING_PATTERN = /\b(warning|error|failed|blocked|variance|discrepancy|unable|invalid|required)\b/i;

export function WarningBuzzer() {
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let lastBuzzAt = 0;

    function prepareAudio() {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
      }
      if (audioContext?.state === "suspended") void audioContext.resume();
    }

    function buzz() {
      const now = Date.now();
      if (now - lastBuzzAt < 1200) return;
      lastBuzzAt = now;
      prepareAudio();
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.11);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.24);
    }

    function isWarningNode(node: Node) {
      if (!(node instanceof HTMLElement)) return false;
      if (node.dataset.warning !== undefined || node.getAttribute("role") === "alert") return true;
      const text = node.textContent?.trim() ?? "";
      return text.length > 0 && text.length < 500 && WARNING_PATTERN.test(text);
    }

    function handleMutation(records: MutationRecord[]) {
      if (records.some((record) => Array.from(record.addedNodes).some(isWarningNode))) buzz();
    }

    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      buzz();
      originalAlert(message);
    };
    window.addEventListener("pointerdown", prepareAudio, { passive: true });
    window.addEventListener("keydown", prepareAudio, { passive: true });
    window.addEventListener("lottoops:warning", buzz);
    const observer = new MutationObserver(handleMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.alert = originalAlert;
      window.removeEventListener("pointerdown", prepareAudio);
      window.removeEventListener("keydown", prepareAudio);
      window.removeEventListener("lottoops:warning", buzz);
      audioContext?.close().catch(() => undefined);
    };
  }, []);

  return null;
}
