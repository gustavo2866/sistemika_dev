"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { CRMContactoForm } from "./form";
import { normalizeCRMContactoPayload } from "./model";

type CRMContactoCreateProps = {
  embedded?: boolean;
  onCreated?: (record: Record<string, unknown>) => void;
  onCancel?: () => void;
  redirect?: BaseCreateProps["redirect"];
};

const CRMContactoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-2">
      <UserRound className="h-4 w-4" />
      Crear contacto CRM
    </span>
    <Badge variant="secondary" className="text-[11px]">
      Nuevo
    </Badge>
  </div>
);

export const CRMContactoCreate = ({
  embedded = false,
  onCreated,
  onCancel,
  redirect,
}: CRMContactoCreateProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title={<CRMContactoCreateTitle />}
      className="max-w-2xl w-full"
      transform={(data: Record<string, unknown>) => normalizeCRMContactoPayload(data)}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: (data) => {
          if (onCreated) {
            onCreated((data as Record<string, unknown>) ?? {});
            return;
          }
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
      <CRMContactoForm onCancel={embedded ? onCancel : undefined} />
    </Create>
  );
};
