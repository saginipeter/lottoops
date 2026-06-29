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
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">

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
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",

                    completed &&
                      "border-purple-600 bg-purple-600 text-white",

                    active &&
                      "border-purple-600 bg-purple-100 text-purple-700",

                    !completed &&
                      !active &&
                      "border-gray-300 bg-white text-gray-400"
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
                        ? "text-purple-700"
                        : completed
                        ? "text-gray-900"
                        : "text-gray-400"
                    )}
                  >
                    {step.title}
                  </p>

                  <p className="text-xs text-gray-500">
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
                      ? "bg-purple-600"
                      : "bg-gray-200"
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