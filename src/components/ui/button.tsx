import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          size === "md" ? "h-8 px-3 text-xs" : "h-[26px] px-2 text-[10px]",
          variant === "primary" &&
            "bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover",
          variant === "secondary" &&
            "bg-surface text-text border border-border hover:bg-surface-soft",
          variant === "success" &&
            "bg-success text-white border border-success hover:bg-success-soft-text hover:border-success-soft-text",
          variant === "danger" &&
            "bg-danger text-white border border-danger hover:bg-danger-hover hover:border-danger-hover",
          variant === "ghost" &&
            "text-text-secondary hover:text-text hover:bg-surface-soft",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
