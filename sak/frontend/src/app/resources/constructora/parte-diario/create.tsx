"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { ParteDiarioForm } from "./form";
import {
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  normalizeParteDiarioPayload,
} from "./model";

type ParteDiarioCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const ParteDiarioCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Registrar parte diario</span>
    <Badge variant="secondary" className={getEstadoParteBadgeClass("pendiente")}>
      {getEstadoParteLabel("pendiente")}
    </Badge>
  </div>
);

export const ParteDiarioCreate = ({
  embedded = false,
  redirect,
}: ParteDiarioCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ParteDiarioCreateTitle />}
    className="max-w-5xl w-full"
    transform={normalizeParteDiarioPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ParteDiarioForm />
  </Create>
);
