"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { PropiedadServicioForm } from "./form";

export const PropiedadServicioCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={redirect ?? false}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      title={<ResourceTitle icon={Zap} text="Nuevo servicio de propiedad" />}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => navigate(returnTo ?? "/propiedades-servicios"),
            }
      }
    >
      <PropiedadServicioForm />
    </Create>
  );
};
