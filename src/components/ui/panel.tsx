import clsx from "clsx";
import { HTMLAttributes } from "react";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "card-surface rounded-lg",
        className
      )}
      {...props}
    />
  );
}
