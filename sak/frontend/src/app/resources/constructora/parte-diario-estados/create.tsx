"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ParteDiarioEstadoForm } from "./form";
import { normalizeParteDiarioEstadoPayload } from "./model";

type ParteDiarioEstadoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ParteDiarioEstadoCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear estado de parte diario</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const ParteDiarioEstadoCreate = ({
  embedded = false,
  redirect,
}: ParteDiarioEstadoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ParteDiarioEstadoCreateTitle />}
    className="max-w-2xl w-full"
    transform={(data: any) => normalizeParteDiarioEstadoPayload(data)}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ParteDiarioEstadoForm />
  </Create>
);
