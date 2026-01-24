"use client";

import { Create } from "@/components/create";
import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { PoSolicitudForm } from "./form";

export const PoSolicitudCreate = () => {
  const location = useLocation();
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnTo") ?? "list";
  }, [location.search]);

  return (
    <Create redirect={redirectTo} title="Nueva Solicitud">
      <PoSolicitudForm />
    </Create>
  );
};

