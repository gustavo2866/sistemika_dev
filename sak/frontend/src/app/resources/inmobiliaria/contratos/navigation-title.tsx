"use client";

import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";

type LocationState = {
  returnTo?: string;
} | null;

type ContratoBackButtonProps = {
  returnTo?: string;
};

export const ContratoBackButton = ({ returnTo }: ContratoBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;
  const resolvedReturnTo = returnTo ?? locationState?.returnTo ?? getReturnToFromLocation(location);

  const handleBack = () => {
    if (resolvedReturnTo) {
      navigate(resolvedReturnTo);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/contratos");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-6 px-1.5 text-[11px] font-medium text-primary"
      onClick={handleBack}
    >
      <ArrowLeft className="mr-1 h-3 w-3" />
      Volver
    </Button>
  );
};
