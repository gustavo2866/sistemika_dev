"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { TarjaEstadoForm } from "./form";
import { normalizeTarjaEstadoPayload } from "./model";

type TarjaEstadoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const TarjaEstadoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear estado de tarja</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const TarjaEstadoCreate = ({
  embedded = false,
  redirect,
}: TarjaEstadoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TarjaEstadoCreateTitle />}
    className="max-w-2xl w-full"
    transform={(data: any) => normalizeTarjaEstadoPayload(data)}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TarjaEstadoForm />
  </Create>
);
