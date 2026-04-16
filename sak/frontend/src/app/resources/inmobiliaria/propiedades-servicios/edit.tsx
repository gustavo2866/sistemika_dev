"use client";

import { Edit } from "@/components/edit";
import type { SetupEditComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { PropiedadServicioForm } from "./form";

export const PropiedadServicioEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={redirect ?? false}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      title={<ResourceTitle icon={Zap} text="Editar servicio de propiedad" />}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () =>
                navigate(returnTo ?? "/propiedades-servicios", { replace: true }),
            }
      }
    >
      <PropiedadServicioForm />
    </Edit>
  );
};
