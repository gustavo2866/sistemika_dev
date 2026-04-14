"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ContratoForm } from "./form";

export const ContratoCreate = ({
  embedded = false,
  redirect,
}: SetupCreateComponentProps) => {
  const navigate = useNavigate();
  return (
    <Create
      redirect={redirect ?? false}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      title={<ResourceTitle icon={FileText} text="Crear contrato" />}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => navigate("/contratos"),
            }
      }
    >
      <ContratoForm />
    </Create>
  );
};
