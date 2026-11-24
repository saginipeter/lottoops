"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export type ReceivingGuideStep = 1 | 2 | 3 | 4;

interface GuidedPromptProps {
  step: ReceivingGuideStep;
  title: string;
  instruction: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAcknowledge: () => void | Promise<void>;
  onDismiss: () => void;
}

/** A non-modal prompt that keeps the receiving form usable underneath it. */
export function GuidedPrompt({
  step,
  title,
  instruction,
  actionLabel,
  actionDisabled = false,
  onAcknowledge,
  onDismiss,
}: GuidedPromptProps) {
  const [advancing, setAdvancing] = useState(false);

  const acknowledge = useCallback(async () => {
    if (actionDisabled || advancing) return;
    setAdvancing(true);
    try {
      await onAcknowledge();
    } finally {
      setAdvancing(false);
    }
  }, [actionDisabled, advancing, onAcknowledge]);

  useEffect(() => {
    function handleEnter(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.defaultPrevented || event.isComposing || actionDisabled || advancing) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, textarea, select, [contenteditable='true']")) return;
      if (target instanceof HTMLInputElement && target.type === "file") return;
      if (step === 4 && (
        !(target instanceof HTMLInputElement) ||
        target.placeholder !== "Scan Pack" ||
        target.value.trim() !== ""
      )) return;
      event.preventDefault();
      void acknowledge();
    }

    window.addEventListener("keydown", handleEnter, true);
    return () => window.removeEventListener("keydown", handleEnter, true);
  }, [acknowledge, actionDisabled, advancing, step]);

  return (
    <div className="fixed inset-x-3 bottom-20 z-[80] mx-auto max-w-md sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-20 sm:w-80">
      <Panel
        role="dialog"
        aria-modal="false"
        aria-labelledby="receiving-guide-title"
        aria-describedby="receiving-guide-instruction"
        className="border-accent/40 bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Receiving guide · Prompt {step} of 4</p>
            <h2 id="receiving-guide-title" className="mt-1 text-sm font-semibold text-text">{title}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss} aria-label="Hide receiving guide">
            <X size={15} />
          </Button>
        </div>
        <p id="receiving-guide-instruction" className="mt-2 text-xs leading-5 text-text-secondary">{instruction}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] text-text-tertiary">Press Enter or select OK</span>
          <Button type="button" size="sm" onClick={() => { void acknowledge(); }} disabled={actionDisabled || advancing}>
            {advancing ? "Please wait…" : actionLabel}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
