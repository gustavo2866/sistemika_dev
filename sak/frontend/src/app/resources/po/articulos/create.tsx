"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ArticuloForm } from "./form";

type ArticuloCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ArticuloCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear articulo</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const ArticuloCreate = ({
  embedded = false,
  redirect,
}: ArticuloCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ArticuloCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ArticuloForm />
  </Create>
);
