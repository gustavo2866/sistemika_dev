"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { NotebookPen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ParteDiarioForm } from "./form";
import { ParteDiarioBackButton } from "./navigation-title";
import {
  PARTE_DIARIO_DEFAULTS,
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  normalizeParteDiarioPayload,
} from "./model";

type ParteDiarioCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ParteDiarioCreateTitle = ({ returnTo }: { returnTo?: string | null }) => (
  <div className="flex flex-wrap items-center gap-2">
    <ParteDiarioBackButton returnTo={returnTo} />
    <span className="inline-flex items-center gap-2">
      <NotebookPen className="h-4 w-4" />
      Registrar parte diario
    </span>
    <Badge variant="secondary" className={getEstadoParteBadgeClass("borrador")}>
      {getEstadoParteLabel("borrador")}
    </Badge>
  </div>
);

export const ParteDiarioCreate = ({
  embedded = false,
  redirect,
}: ParteDiarioCreateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const idproyectoParam = params.get("idproyecto");
  const fechaParam = params.get("fecha");
  const contactoIdParam = params.get("contacto_id");
  const idproyecto = idproyectoParam ? Number(idproyectoParam) : undefined;
  const contactoId = contactoIdParam ? Number(contactoIdParam) : undefined;
  const defaultValues = {
    ...PARTE_DIARIO_DEFAULTS,
    ...(Number.isFinite(idproyecto) && idproyecto ? { idproyecto } : {}),
    ...(Number.isFinite(contactoId) && contactoId ? { contacto_id: contactoId } : {}),
    ...(fechaParam ? { fecha: fechaParam } : {}),
  };

  return (
    <Create
      redirect={redirect ?? false}
      record={defaultValues}
      title={<ParteDiarioCreateTitle returnTo={returnTo} />}
      className="max-w-5xl w-full"
      transform={normalizeParteDiarioPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                if (returnTo) {
                  navigate(returnTo, { replace: true });
                  return;
                }
                navigate("/parte-diario", { replace: true });
              },
            }
      }
    >
      <ParteDiarioForm defaultValues={defaultValues} returnTo={returnTo} />
    </Create>
  );
};
