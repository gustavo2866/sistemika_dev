"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { TipoArticuloForm } from "./form";

type TipoArticuloCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const TipoArticuloCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear tipo de articulo</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const TipoArticuloCreate = ({
  embedded = false,
  redirect,
}: TipoArticuloCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TipoArticuloCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TipoArticuloForm />
  </Create>
);
