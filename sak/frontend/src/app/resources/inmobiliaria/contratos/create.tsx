"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { FileText } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContratoForm } from "./form";
import { ContratoBackButton } from "./navigation-title";

export const ContratoCreate = ({
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
      title={
        <div className="flex items-center gap-2">
          <ContratoBackButton returnTo={returnTo ?? undefined} />
          <ResourceTitle icon={FileText} text="Crear contrato" />
        </div>
      }
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: (data) => {
                const createdId = data?.id;

                if (createdId != null) {
                  const nextParams = new URLSearchParams();
                  if (returnTo) {
                    nextParams.set("returnTo", returnTo);
                  }
                  const nextSearch = nextParams.toString();

                  navigate(`/contratos/${createdId}${nextSearch ? `?${nextSearch}` : ""}`, {
                    replace: true,
                    state: returnTo ? { returnTo } : undefined,
                  });
                  return;
                }

                navigate(returnTo ?? "/contratos", { replace: true });
              },
            }
      }
    >
      <ContratoForm />
    </Create>
  );
};
