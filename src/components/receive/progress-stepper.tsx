"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

interface ProgressStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
}

const steps = [
  {
    id: 1,
    title: "Invoice",
    description: "Upload invoice",
  },
  {
    id: 2,
    title: "Scan Pack",
    description: "Scan pack barcodes",
  },
  {
    id: 3,
    title: "Review",
    description: "Verify shipment",
  },
  {
    id: 4,
    title: "Confirm",
    description: "Move to backstock",
  },
];

export function ProgressStepper({
  currentStep,
  onStepClick,
}: ProgressStepperProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">

      <div className="flex items-center justify-between">

        {steps.map((step, index) => {
          const completed = step.id < currentStep;
          const active = step.id === currentStep;

          return (
            <div
              key={step.id}
              className="flex flex-1 items-center"
            >
              <button
                type="button"
                className="flex items-center text-left disabled:cursor-default"
                onClick={() => onStepClick?.(step.id as 1 | 2 | 3 | 4)}
                disabled={!onStepClick}
                aria-current={active ? "step" : undefined}
              >

                {/* Circle */}

                <div
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",

                    completed &&
                      "border-blue-700 bg-blue-700 text-white",

                    active &&
                      "border-blue-700 bg-blue-50 text-blue-700",

                    !completed &&
                      !active &&
                      "border-border bg-background text-text-tertiary"
                  )}
                >
                  {completed ? (
                    <Check size={18} />
                  ) : active ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden="true" />
                  ) : null}
                </div>

                {/* Text */}

                <div className="ml-3">

                  <p
                    className={clsx(
                      "text-sm font-semibold",

                      active
                        ? "text-blue-700"
                        : completed
                        ? "text-text"
                        : "text-text-tertiary"
                    )}
                  >
                    {step.title}
                  </p>

                  <p className="text-xs text-text-tertiary">
                    {step.description}
                  </p>

                </div>

              </button>

              {/* Connecting Line */}

              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    "mx-4 h-1 flex-1 rounded-full",

                    step.id < currentStep
                      ? "bg-blue-700"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
