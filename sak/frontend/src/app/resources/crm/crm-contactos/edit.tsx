"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { UserRound } from "lucide-react";
import { useEditContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";

import { CRMContactoForm } from "./form";
import { normalizeCRMContactoPayload, type CRMContacto } from "./model";
import { CRMContactoBackButton } from "./navigation-title";

type CRMContactoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const CRMContactoEditTitle = ({
  fallbackTo,
  returnTo,
}: {
  fallbackTo?: string;
  returnTo?: string;
}) => {
  const { record } = useEditContext<CRMContacto>();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CRMContactoBackButton fallbackTo={fallbackTo} returnTo={returnTo} />
      <span className="inline-flex items-center gap-2">
        <UserRound className="h-4 w-4" />
        Editar contacto CRM
      </span>
      {record?.id ? (
        <Badge variant="outline" className="text-[11px]">
          #{String(record.id).padStart(6, "0")}
        </Badge>
      ) : null}
    </div>
  );
};

const CRMContactoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

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
      title={
        <CRMContactoEditTitle
          fallbackTo={typeof redirect === "string" ? redirect : undefined}
          returnTo={returnTo ?? undefined}
        />
      }
      className="max-w-2xl w-full"
      actions={<CRMContactoEditActions />}
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
