"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ProveedorForm } from "./form";

type ProveedorCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ProveedorCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear proveedor</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const ProveedorCreate = ({
  embedded = false,
  redirect,
}: ProveedorCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ProveedorCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProveedorForm />
  </Create>
);
