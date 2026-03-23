"use client";

import { useLocation, useNavigate } from "react-router-dom";
import type { CreateProps as BaseCreateProps } from "@/components/create";
import { UserRound } from "lucide-react";
import { Create } from "@/components/create";
import { ResourceTitle } from "@/components/resource-title";
import { CRMContactoForm } from "./form";
import { normalizeCRMContactoPayload } from "./model";

type CRMContactoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const CRMContactoCreate = ({
  embedded = false,
  redirect,
}: CRMContactoCreateProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={<ResourceTitle icon={UserRound} text="Crear Contacto CRM" />}
      transform={(data: Record<string, unknown>) => normalizeCRMContactoPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            navigate(returnTo);
            return;
          }
          if (typeof redirect === "string") {
            navigate(redirect);
            return;
          }
          navigate("/crm/contactos");
        },
      }}
    >
      <CRMContactoForm />
    </Create>
  );
};
