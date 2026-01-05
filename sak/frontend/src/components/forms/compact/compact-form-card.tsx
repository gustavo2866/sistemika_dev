import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const compactFormClasses = [
  "[&_[data-slot=form-item]]:gap-1.5",
  "[&_[data-slot=form-label]]:!text-[9px]",
  "[&_[data-slot=form-label]]:uppercase",
  "[&_[data-slot=form-label]]:tracking-[0.18em]",
  "[&_label]:!text-[9px]",
  "[&_label]:uppercase",
  "[&_label]:tracking-[0.18em]",
  "[&_[data-slot=input]]:h-7",
  "[&_[data-slot=input]]:px-2",
  "[&_[data-slot=input]]:!text-[11px]",
  "[&_[data-slot=textarea]]:min-h-9",
  "[&_[data-slot=textarea]]:px-2",
  "[&_[data-slot=textarea]]:py-1",
  "[&_[data-slot=textarea]]:!text-[11px]",
  "[&_[data-slot=select-trigger]]:h-7",
  "[&_[data-slot=select-trigger]]:px-2",
  "[&_[data-slot=select-trigger]]:!text-[11px]",
  "sm:[&_[data-slot=form-label]]:!text-[11px]",
  "sm:[&_[data-slot=form-label]]:tracking-[0.15em]",
  "sm:[&_label]:!text-[11px]",
  "sm:[&_label]:tracking-[0.15em]",
  "sm:[&_[data-slot=input]]:h-8",
  "sm:[&_[data-slot=input]]:px-3",
  "sm:[&_[data-slot=input]]:text-sm",
  "sm:[&_[data-slot=textarea]]:min-h-16",
  "sm:[&_[data-slot=textarea]]:px-3",
  "sm:[&_[data-slot=textarea]]:py-2",
  "sm:[&_[data-slot=textarea]]:text-sm",
  "sm:[&_[data-slot=select-trigger]]:h-8",
  "sm:[&_[data-slot=select-trigger]]:px-3",
  "sm:[&_[data-slot=select-trigger]]:text-sm",
].join(" ");

const compactCardClasses =
  "flex w-full flex-col gap-4 p-3 sm:gap-5 sm:p-4";

export const CompactFormCard = ({
  className,
  ...props
}: React.ComponentProps<typeof Card>) => {
  return (
    <Card
      className={cn(compactFormClasses, compactCardClasses, className)}
      {...props}
    />
  );
};
