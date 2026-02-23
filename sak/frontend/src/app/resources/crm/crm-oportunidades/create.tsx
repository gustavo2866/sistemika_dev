"use client";

import { Create } from "@/components/create";
import { useLocation, useNavigate } from "react-router-dom";
import { getReturnToFromLocation } from "@/lib/oportunidad-context";
import { CRMOportunidadPoForm } from "./form";
import { Target } from "lucide-react";

export const CRMOportunidadPoCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = getReturnToFromLocation(location);

  return (
    <Create
      redirect={false}
      title={
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4" />
          Crear Oportunidad
        </span>
      }
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            navigate(returnTo);
            return;
          }
          navigate("/crm/crm-oportunidades");
        },
      }}
    >
      <CRMOportunidadPoForm />
    </Create>
  );
};

export default CRMOportunidadPoCreate;
