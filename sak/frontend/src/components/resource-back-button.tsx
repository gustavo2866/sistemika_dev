"use client";

import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type LocationState = {
  returnTo?: string;
} | null;

export type ResourceBackButtonProps = {
  fallbackTo: string;
  returnTo?: string | null;
  historyFallback?: boolean;
  resolveLocationReturnTo?: boolean;
  stopPropagation?: boolean;
  className?: string;
  iconClassName?: string;
  label?: string;
};

export const ResourceBackButton = ({
  fallbackTo,
  returnTo,
  historyFallback = true,
  resolveLocationReturnTo = true,
  stopPropagation = false,
  className,
  iconClassName,
  label = "Volver",
}: ResourceBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;
  const resolvedReturnTo = resolveLocationReturnTo
    ? returnTo ??
      locationState?.returnTo ??
      getReturnToFromLocation(location)
    : returnTo;

  const handleBack = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) event.stopPropagation();
    if (resolvedReturnTo) {
      navigate(resolvedReturnTo);
      return;
    }
    if (
      historyFallback &&
      typeof window !== "undefined" &&
      window.history.length > 1
    ) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-6 px-1.5 text-[11px] font-medium text-primary",
        className,
      )}
      onClick={handleBack}
    >
      <ArrowLeft className={cn("mr-1 h-3 w-3", iconClassName)} />
      {label}
    </Button>
  );
};
