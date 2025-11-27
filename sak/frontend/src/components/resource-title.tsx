"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ResourceTitleProps = {
  icon: LucideIcon;
  text: string;
  className?: string;
};

export const ResourceTitle = ({ icon: Icon, text, className }: ResourceTitleProps) => (
  <div className={cn("flex items-center gap-3 text-xl font-semibold", className)}>
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
    <span>{text}</span>
  </div>
);
