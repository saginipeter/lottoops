import clsx from "clsx";
import { HTMLAttributes } from "react";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-surface",
        className
      )}
      {...props}
    />
  );
}
