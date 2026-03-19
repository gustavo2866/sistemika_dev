"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { TipoSolicitudForm } from "./form";

type TipoSolicitudCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const TipoSolicitudCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tipo de solicitud</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const TipoSolicitudCreate = ({
  embedded = false,
  redirect,
}: TipoSolicitudCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TipoSolicitudCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TipoSolicitudForm />
  </Create>
);
