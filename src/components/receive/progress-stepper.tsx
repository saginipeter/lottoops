"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

interface ProgressStepperProps {
  currentStep: 1 | 2 | 3 | 4;
}

const steps = [
  {
    id: 1,
    title: "Invoice",
    description: "Upload invoice",
  },
  {
    id: 2,
    title: "Scan Packs",
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
              <div className="flex items-center">

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
                  ) : (
                    step.id
                  )}
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

              </div>

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