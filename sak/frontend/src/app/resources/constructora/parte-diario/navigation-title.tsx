"use client";

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";

type ParteDiarioBackButtonProps = {
  fallbackPath?: string;
  returnTo?: string | null;
};

export const ParteDiarioBackButton = ({
  fallbackPath = "/parte-diario",
  returnTo,
}: ParteDiarioBackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackPath);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-8 px-2 text-sm font-medium text-primary"
      onClick={handleBack}
    >
      <ArrowLeft className="mr-1 h-3.5 w-3.5" />
      Volver
    </Button>
  );
};
