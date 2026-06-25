"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { TarjaForm } from "./form";
import {
  TARJA_DEFAULTS,
  getEstadoTarjaBadgeClass,
  getEstadoTarjaLabel,
  normalizeTarjaPayload,
} from "./model";

type TarjaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const TarjaCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-2">
      <ClipboardCheck className="h-4 w-4" />
      Crear tarja
    </span>
    <Badge variant="secondary" className={getEstadoTarjaBadgeClass("borrador")}>
      {getEstadoTarjaLabel("borrador")}
    </Badge>
  </div>
);

export const TarjaCreate = ({
  embedded = false,
  redirect,
}: TarjaCreateProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const idproyectoParam = params.get("idproyecto");
  const idproyecto = idproyectoParam ? Number(idproyectoParam) : undefined;
  const fechainicio = params.get("fechainicio");
  const fechafinal = params.get("fechafinal");
  const defaultValues = {
    ...TARJA_DEFAULTS,
    ...(Number.isFinite(idproyecto) && idproyecto ? { idproyecto } : {}),
    ...(fechainicio ? { fechainicio } : {}),
    ...(fechafinal ? { fechafinal } : {}),
  };

  return (
    <Create
      redirect={redirect ?? false}
      title={<TarjaCreateTitle />}
      className="max-w-5xl w-full"
      transform={normalizeTarjaPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                navigate(returnTo || "/tarjas", { replace: true });
              },
            }
      }
    >
      <TarjaForm defaultValues={defaultValues} />
    </Create>
  );
};
