"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ButtonToggleOption<T = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: {
    color: string;
    textColor?: string;
  };
}

export interface ButtonToggleProps<T = string> {
  options: ButtonToggleOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  variant?: "rounded" | "square" | "pills";
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

export function ButtonToggle<T = string>({
  options,
  value,
  onChange,
  variant = "rounded",
  size = "md",
  className,
  "aria-label": ariaLabel,
}: ButtonToggleProps<T>) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs min-w-[70px]",
    md: "px-5 py-2 text-sm min-w-[92px]",
    lg: "px-6 py-2.5 text-base min-w-[110px]",
  };

  const variantClasses = {
    rounded: "rounded-full",
    square: "rounded-md",
    pills: "rounded-full",
  };

  const containerVariantClasses = {
    rounded: "rounded-full",
    square: "rounded-lg",
    pills: "rounded-full",
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel || "Toggle options"}
      className={cn(
        "flex items-center justify-center gap-1 border border-slate-200/80 bg-white/80 px-1 py-1 shadow-[0_1px_6px_rgba(15,23,42,0.08)] backdrop-blur-sm",
        containerVariantClasses[variant],
        className
      )}
    >
      {options.map((option, index) => {
        const isActive = value === option.id;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        const badgeColors = option.badge?.color ?? "bg-slate-100 text-slate-800";
        const textColor = option.badge?.textColor ?? "";

        return (
          <button
            key={String(option.id)}
            type="button"
            aria-pressed={isActive}
            data-active={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "font-semibold uppercase tracking-wide transition-all duration-200",
              sizeClasses[size],
              variantClasses[variant],
              isFirst && variant === "rounded" ? "rounded-l-full" : "",
              isLast && variant === "rounded" ? "rounded-r-full" : "",
              isActive
                ? cn(
                    badgeColors,
                    textColor,
                    "shadow-[0_4px_16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200"
                  )
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {option.icon && (
              <span className="mr-1.5 inline-flex items-center">{option.icon}</span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
