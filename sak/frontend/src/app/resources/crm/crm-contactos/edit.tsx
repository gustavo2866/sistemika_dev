"use client";

import { useLocation, useNavigate } from "react-router-dom";
import type { EditProps as BaseEditProps } from "@/components/edit";
import { UserRound } from "lucide-react";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { CRMContactoForm } from "./form";
import { normalizeCRMContactoPayload } from "./model";

type CRMContactoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

export const CRMContactoEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMContactoEditProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={false}
      mutationMode="pessimistic"
      title={<ResourceTitle icon={UserRound} text="Editar Contacto CRM" />}
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
    </Edit>
  );
};
