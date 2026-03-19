"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { DepartamentoForm } from "./form";

type DepartamentoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const DepartamentoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear departamento</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const DepartamentoCreate = ({
  embedded = false,
  redirect,
}: DepartamentoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<DepartamentoCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <DepartamentoForm />
  </Create>
);
